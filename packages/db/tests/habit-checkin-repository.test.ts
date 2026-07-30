import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/client";
import { HabitCheckInRepository } from "../src/repositories/habit-checkin-repository";
import { uniquePhone } from "./fixtures";

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
    const user = await prisma.user.create({ data: { phone: uniquePhone() } });
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
  // Guarded: if before() failed, userId is undefined and an unguarded delete
  // throws a Prisma validation error that buries the real failure — which is
  // exactly what happened when two files collided on a duplicate phone.
  if (userId) await prisma.user.delete({ where: { id: userId } });
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

// findCheckedDaysForHabits expresses "(year, month, day) >= since" as a
// three-branch OR across three separate integer columns. The core fake
// reimplements that comparison in TypeScript, so it can only ever prove the
// fake agrees with itself — a wrong OR (say, `gt` where `gte` belongs, or
// branches that overlap and double-count) would look identical there. This
// is the seam where the real SQL gets checked.
test("findCheckedDaysForHabits applies a correct lexicographic date bound", async () => {
  const other = await prisma.habit.create({ data: { userId, name: "Second Habit" } });
  const days = [
    { jalaliYear: 1402, jalaliMonth: 12, jalaliDay: 29 }, // before  — excluded
    { jalaliYear: 1403, jalaliMonth: 4, jalaliDay: 9 }, // before (same year, earlier month)
    { jalaliYear: 1403, jalaliMonth: 5, jalaliDay: 9 }, // before (same year+month, earlier day)
    { jalaliYear: 1403, jalaliMonth: 5, jalaliDay: 10 }, // exactly the bound — INCLUDED
    { jalaliYear: 1403, jalaliMonth: 5, jalaliDay: 11 }, // after (later day)
    { jalaliYear: 1403, jalaliMonth: 6, jalaliDay: 1 }, // after (later month)
    { jalaliYear: 1404, jalaliMonth: 1, jalaliDay: 1 }, // after (later year)
  ];
  for (const day of days) {
    await repo.checkIn({ ...day, habitId: other.id, userId, checkedAt: new Date() });
  }

  const since = { jalaliYear: 1403, jalaliMonth: 5, jalaliDay: 10 };
  const found = await repo.findCheckedDaysForHabits([other.id], since);

  // Boundary day included (>=, not >), and each of the three "before"
  // branches excluded for a different reason.
  assert.equal(found.length, 4);
  assert.ok(
    found.some((d) => d.jalaliYear === 1403 && d.jalaliMonth === 5 && d.jalaliDay === 10),
    "the boundary day itself must be included",
  );
  assert.ok(!found.some((d) => d.jalaliYear === 1402), "prior year must be excluded");
  assert.ok(
    !found.some((d) => d.jalaliMonth === 4),
    "earlier month in the same year must be excluded",
  );

  // No duplicates: overlapping OR branches would return a row more than once.
  const keys = found.map((d) => `${d.jalaliYear}-${d.jalaliMonth}-${d.jalaliDay}`);
  assert.equal(new Set(keys).size, keys.length, "OR branches must not overlap");
});

test("findCheckedDaysForHabits batches habits and excludes soft-deleted days", async () => {
  const a = await prisma.habit.create({ data: { userId, name: "Batch A" } });
  const b = await prisma.habit.create({ data: { userId, name: "Batch B" } });
  const day = { jalaliYear: 1403, jalaliMonth: 8, jalaliDay: 3 };

  await repo.checkIn({ ...day, habitId: a.id, userId, checkedAt: new Date() });
  await repo.checkIn({ ...day, habitId: b.id, userId, checkedAt: new Date() });
  // Unchecked afterwards: a soft-deleted row must not resurface in a batch
  // read any more than it does in the per-habit one.
  await repo.uncheck({ ...day, habitId: b.id });

  const since = { jalaliYear: 1403, jalaliMonth: 1, jalaliDay: 1 };
  const found = await repo.findCheckedDaysForHabits([a.id, b.id], since);

  assert.equal(found.length, 1);
  assert.equal(found[0]?.habitId, a.id);
});

test("findCheckedDaysForHabits short-circuits on an empty habit list", async () => {
  const found = await repo.findCheckedDaysForHabits([], {
    jalaliYear: 1403,
    jalaliMonth: 1,
    jalaliDay: 1,
  });
  assert.deepEqual(found, []);
});
