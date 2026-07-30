import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/client";
import { HabitRepository } from "../src/repositories/habit-repository";
import {
  VersionConflictError,
  RecordVanishedError,
} from "../src/repositories/optimistic-concurrency";
import { uniquePhone } from "./fixtures";

/**
 * Real-Postgres seam for optimistic concurrency (ADR-0020).
 *
 * This tier exists for exactly this case. A `packages/core` fake would satisfy
 * the same assertions by hand-scripting the outcome — an in-memory array can
 * compare a number and decide to throw, which proves only that the fake was
 * written to agree with the test. The claim being made here is that Postgres
 * itself refuses the second write, and only a real database can refute it.
 *
 * The load-bearing case is `Promise.allSettled` over two genuinely concurrent
 * updates. The naive implementation — read the row, compare the version in
 * JavaScript, then write — passes every sequential test and fails this one,
 * because both callers read version 1 before either writes.
 */

const repo = new HabitRepository(prisma);

let userId: string;

before(async () => {
  try {
    const user = await prisma.user.create({ data: { phone: uniquePhone() } });
    userId = user.id;
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

async function newHabit(name: string) {
  return prisma.habit.create({ data: { userId, name, frequency: "DAILY" } });
}

test("two concurrent version-checked updates: exactly one wins", async () => {
  const habit = await newHabit("Concurrent");
  assert.equal(habit.version, 1, "fixture starts at version 1");

  // Both callers hold version 1 — the situation two devices are actually in.
  const results = await Promise.allSettled([
    repo.update(habit.id, { name: "From device A" }, 1),
    repo.update(habit.id, { name: "From device B" }, 1),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 1, "exactly one write may succeed");
  assert.equal(rejected.length, 1, "the loser must be rejected, not silently dropped");
  assert.ok(
    rejected[0]!.status === "rejected" && rejected[0]!.reason instanceof VersionConflictError,
    "the loser gets VersionConflictError, not a raw Prisma error",
  );

  const stored = await prisma.habit.findUniqueOrThrow({ where: { id: habit.id } });
  assert.equal(stored.version, 2, "exactly one increment landed");
  assert.ok(
    ["From device A", "From device B"].includes(stored.name),
    "the surviving write is one of the two, not a mix",
  );
});

test("a stale expectedVersion is rejected and changes nothing", async () => {
  const habit = await newHabit("Stale");
  await repo.update(habit.id, { name: "First" }, 1); // now version 2

  await assert.rejects(
    () => repo.update(habit.id, { name: "Stale write" }, 1),
    VersionConflictError,
  );

  const stored = await prisma.habit.findUniqueOrThrow({ where: { id: habit.id } });
  assert.equal(stored.name, "First", "the rejected write must not have partially applied");
  assert.equal(stored.version, 2);
});

test("VersionConflictError carries the current version, so a client can tell how stale it was", async () => {
  const habit = await newHabit("Reports current");
  await repo.update(habit.id, { name: "a" }, 1);
  await repo.update(habit.id, { name: "b" }, 2); // now version 3

  await assert.rejects(
    () => repo.update(habit.id, { name: "c" }, 1),
    (err: unknown) => err instanceof VersionConflictError && err.currentVersion === 3,
  );
});

test("a matching expectedVersion succeeds and increments", async () => {
  const habit = await newHabit("Happy path");

  const updated = await repo.update(habit.id, { name: "Renamed" }, 1);

  assert.equal(updated.name, "Renamed");
  assert.equal(updated.version, 2, "a successful versioned write still increments");
});

test("omitting expectedVersion skips the check entirely (last-write-wins)", async () => {
  const habit = await newHabit("Unversioned");
  await repo.update(habit.id, { name: "bumped" }, 1); // version 2

  // No precondition, so a caller holding a stale view still wins. This is the
  // documented opt-out that keeps already-installed clients working.
  const updated = await repo.update(habit.id, { name: "unconditional" });

  assert.equal(updated.name, "unconditional");
  assert.equal(updated.version, 3);
});

test("a vanished row is RecordVanishedError, never VersionConflictError", async () => {
  const habit = await newHabit("Vanishing");
  await prisma.habit.delete({ where: { id: habit.id } });

  // The distinction is load-bearing: a client told 409 refetches and retries,
  // a client told 404 stops. Collapsing these makes a sync client retry
  // forever against a row that will never come back.
  await assert.rejects(() => repo.update(habit.id, { name: "ghost" }, 1), RecordVanishedError);
});

test("softDelete honours expectedVersion too", async () => {
  const habit = await newHabit("Delete guard");
  await repo.update(habit.id, { name: "edited elsewhere" }, 1); // version 2

  await assert.rejects(() => repo.softDelete(habit.id, 1), VersionConflictError);

  const stillThere = await prisma.habit.findUniqueOrThrow({ where: { id: habit.id } });
  assert.equal(stillThere.deletedAt, null, "a stale delete must not destroy a newer edit");

  await repo.softDelete(habit.id, 2);
  const deleted = await prisma.habit.findUniqueOrThrow({ where: { id: habit.id } });
  assert.notEqual(deleted.deletedAt, null);
});
