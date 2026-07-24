import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/client";
import { HabitCheckInRepository } from "../src/repositories/habit-checkin-repository";

// Real-Postgres seam for checkIn's upsert-revive behavior — packages/core's
// fake-backed tests simulate this with a plain in-memory Array.find()+mutate,
// which never touches a real DB-wide unique index and so can never disprove
// the assumption that Postgres's own unique constraint applies regardless of
// deletedAt state. See CLAUDE.md's Testing section.

const repo = new HabitCheckInRepository(prisma);

let userId: string;
let habitId: string;

before(async () => {
  try {
    const user = await prisma.user.create({ data: { phone: `+98901${Date.now()}` } });
    userId = user.id;
    const habit = await prisma.habit.create({ data: { userId, name: "Test Habit" } });
    habitId = habit.id;
  } catch (err) {
    throw new Error(
      "Postgres unreachable at DATABASE_URL — run: docker compose up -d postgres && npm run db:migrate -w packages/db",
      { cause: err },
    );
  }
});

after(async () => {
  // Cascades away every fixture row this file created (habit, check-ins) —
  // touches zero rows outside this fixture user's own data.
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

test("checkIn -> uncheck -> checkIn again revives the same row instead of duplicating it", async () => {
  const day = { habitId, jalaliYear: 1403, jalaliMonth: 2, jalaliDay: 10 };

  const first = await repo.checkIn({ ...day, userId, checkedAt: new Date() });
  await repo.uncheck(day);
  const revived = await repo.checkIn({ ...day, userId, checkedAt: new Date() });

  assert.equal(revived.id, first.id);
  assert.equal(revived.deletedAt, null);

  // A raw query bypassing the repository's own findByHabitId (which filters
  // deletedAt: null) is the one assertion an in-memory fake can never make —
  // it has no real unique index to violate.
  const rows = await prisma.habitCheckIn.findMany({
    where: {
      habitId,
      jalaliYear: day.jalaliYear,
      jalaliMonth: day.jalaliMonth,
      jalaliDay: day.jalaliDay,
    },
  });
  assert.equal(rows.length, 1, "exactly one row must exist for this habit/day, never a duplicate");
  assert.equal(rows[0]?.deletedAt, null);
  assert.equal(rows[0]?.version, 3, "create (v1) -> uncheck (v2) -> revive (v3)");
});

test("uncheck on a day with no existing check-in is a no-op, not an error", async () => {
  const day = { habitId, jalaliYear: 1403, jalaliMonth: 3, jalaliDay: 1 };
  const result = await repo.uncheck(day);
  assert.equal(result, null);
});
