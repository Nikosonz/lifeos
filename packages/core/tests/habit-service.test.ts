import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  IHabitRepository,
  IHabitCheckInRepository,
  IAuditLogRepository,
  Habit,
  HabitCheckIn,
} from "@lifeos/db";
import { HabitService } from "../src/habits/services/habit-service";
import { NotFoundError } from "../src/errors/app-error";
import { getJalaliDateForInstant, previousJalaliDay } from "../src/shared/jalali";

function fakeHabitRepository(): IHabitRepository & { rows: Habit[] } {
  const rows: Habit[] = [];
  return {
    rows,
    async create(data) {
      const row: Habit = {
        id: `habit-${rows.length}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        description: data.description ?? null,
        color: data.color ?? null,
        weekdays: data.weekdays ?? [],
        userId: data.userId,
        name: data.name,
        frequency: data.frequency,
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((h) => h.id === id) ?? null;
    },
    async findByUserId(userId) {
      return rows.filter((h) => h.userId === userId && !h.deletedAt);
    },
    async update(id, data) {
      const row = rows.find((h) => h.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    async softDelete(id) {
      const row = rows.find((h) => h.id === id)!;
      row.deletedAt = new Date();
      row.version += 1;
      return row;
    },
  };
}

function fakeHabitCheckInRepository(): IHabitCheckInRepository & {
  rows: HabitCheckIn[];
  /**
   * Counts calls to the batched lookup. Listing N habits must cost exactly
   * ONE of these regardless of N — asserting on the returned streak values
   * alone would stay green if the N+1 came back, since the numbers were
   * always correct. It was the query count that was wrong.
   */
  readonly queryCount: number;
} {
  const rows: HabitCheckIn[] = [];
  let seq = 0;
  let queryCount = 0;
  return {
    rows,
    get queryCount() {
      return queryCount;
    },
    async checkIn(data) {
      const existing = rows.find(
        (c) =>
          c.habitId === data.habitId &&
          c.jalaliYear === data.jalaliYear &&
          c.jalaliMonth === data.jalaliMonth &&
          c.jalaliDay === data.jalaliDay,
      );
      if (existing) {
        existing.deletedAt = null;
        existing.checkedAt = data.checkedAt;
        existing.version += 1;
        return existing;
      }
      const row: HabitCheckIn = {
        id: `checkin-${seq++}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        ...data,
      };
      rows.push(row);
      return row;
    },
    async uncheck(keyData) {
      const existing = rows.find(
        (c) =>
          c.habitId === keyData.habitId &&
          c.jalaliYear === keyData.jalaliYear &&
          c.jalaliMonth === keyData.jalaliMonth &&
          c.jalaliDay === keyData.jalaliDay,
      );
      if (!existing || existing.deletedAt) return null;
      existing.deletedAt = new Date();
      existing.version += 1;
      return existing;
    },
    async findByHabitId(habitId) {
      return rows
        .filter((c) => c.habitId === habitId && !c.deletedAt)
        .sort(
          (a, b) =>
            a.jalaliYear - b.jalaliYear ||
            a.jalaliMonth - b.jalaliMonth ||
            a.jalaliDay - b.jalaliDay,
        );
    },
    async findByHabitIdAndMonth(habitId, jalaliYear, jalaliMonth) {
      return rows.filter(
        (c) =>
          c.habitId === habitId &&
          c.jalaliYear === jalaliYear &&
          c.jalaliMonth === jalaliMonth &&
          !c.deletedAt,
      );
    },
    async findCheckedDaysForHabits(habitIds, since) {
      queryCount += 1;
      const ids = new Set(habitIds);
      // Same lexicographic (year, month, day) >= since comparison the real
      // repository expresses as a three-branch OR in SQL.
      const onOrAfter = (c: HabitCheckIn) =>
        c.jalaliYear !== since.jalaliYear
          ? c.jalaliYear > since.jalaliYear
          : c.jalaliMonth !== since.jalaliMonth
            ? c.jalaliMonth > since.jalaliMonth
            : c.jalaliDay >= since.jalaliDay;
      return rows
        .filter((c) => ids.has(c.habitId) && !c.deletedAt && onOrAfter(c))
        .map((c) => ({
          habitId: c.habitId,
          jalaliYear: c.jalaliYear,
          jalaliMonth: c.jalaliMonth,
          jalaliDay: c.jalaliDay,
        }));
    },
  };
}

function fakeAuditLogRepository(): IAuditLogRepository {
  return {
    async record(data) {
      return {
        id: "audit-0",
        createdAt: new Date(),
        userId: data.userId ?? null,
        action: data.action,
        metadata: null,
      };
    },
  };
}

// Exposes the check-in fake so a test can assert on how many queries the
// service issued, not just on what it returned. makeService() stays the
// plain form every existing test uses.
function makeServiceWithRepos() {
  const checkIns = fakeHabitCheckInRepository();
  const service = new HabitService(fakeHabitRepository(), checkIns, fakeAuditLogRepository());
  return { service, checkIns };
}

function makeService() {
  return makeServiceWithRepos().service;
}

test("createHabit then listHabits returns it with a zero streak and checkedToday false", async () => {
  const service = makeService();
  await service.createHabit("user-1", { name: "Read", frequency: "DAILY" });

  const habits = await service.listHabits("user-1");
  assert.equal(habits.length, 1);
  assert.equal(habits[0]?.name, "Read");
  assert.equal(habits[0]?.streak, 0);
  assert.equal(habits[0]?.checkedToday, false);
});

test("checkIn marks the habit checked today and gives it a streak of 1", async () => {
  const service = makeService();
  const habit = await service.createHabit("user-1", { name: "Read", frequency: "DAILY" });

  await service.checkIn(habit.id, "user-1");

  const habits = await service.listHabits("user-1");
  assert.equal(habits[0]?.checkedToday, true);
  assert.equal(habits[0]?.streak, 1);
});

test("checkIn is idempotent for the same day (no duplicate row, streak stays 1)", async () => {
  const service = makeService();
  const habit = await service.createHabit("user-1", { name: "Read", frequency: "DAILY" });

  await service.checkIn(habit.id, "user-1");
  await service.checkIn(habit.id, "user-1");

  const habits = await service.listHabits("user-1");
  assert.equal(habits[0]?.streak, 1);
});

test("uncheck reverts checkedToday and drops the streak back to zero", async () => {
  const service = makeService();
  const habit = await service.createHabit("user-1", { name: "Read", frequency: "DAILY" });
  await service.checkIn(habit.id, "user-1");

  await service.uncheck(habit.id, "user-1");

  const habits = await service.listHabits("user-1");
  assert.equal(habits[0]?.checkedToday, false);
  assert.equal(habits[0]?.streak, 0);
});

test("checkIn then uncheck then checkIn again revives the same row rather than erroring", async () => {
  const service = makeService();
  const habit = await service.createHabit("user-1", { name: "Read", frequency: "DAILY" });

  await service.checkIn(habit.id, "user-1");
  await service.uncheck(habit.id, "user-1");
  await service.checkIn(habit.id, "user-1");

  const habits = await service.listHabits("user-1");
  assert.equal(habits[0]?.checkedToday, true);
});

// Cross-user rejection on updateHabit/deleteHabit is OwnedResourceCrud's own
// generic behavior, tested once in owned-resource-crud.test.ts — this is a
// wiring smoke test confirming updateHabit reaches it, applies the change,
// and still returns the withStatus-wrapped shape (streak/checkedToday)
// afterward (see ADR-0010).
test("updateHabit changes the name for its real owner and still returns streak/checkedToday", async () => {
  const service = makeService();
  const habit = await service.createHabit("user-1", { name: "Read", frequency: "DAILY" });

  const updated = await service.updateHabit(habit.id, "user-1", { name: "Read daily" });

  assert.equal(updated.name, "Read daily");
  assert.equal(updated.streak, 0);
  assert.equal(updated.checkedToday, false);
});

// checkIn/uncheck/listCheckInsForMonth are Habit-specific methods that
// compose crud.getOwned by hand (they're not one of the three bundled
// convenience methods) — this proves that composition actually happens,
// which the generic OwnedResourceCrud tests can't reach on their own.
test("checkIn throws NotFoundError for a habit owned by a different user", async () => {
  const service = makeService();
  const habit = await service.createHabit("user-1", { name: "Read", frequency: "DAILY" });

  await assert.rejects(() => service.checkIn(habit.id, "user-2"), NotFoundError);
});

test("deleteHabit soft-deletes and removes the habit from listHabits", async () => {
  const service = makeService();
  const habit = await service.createHabit("user-1", { name: "Read", frequency: "DAILY" });

  await service.deleteHabit(habit.id, "user-1");

  const habits = await service.listHabits("user-1");
  assert.equal(habits.length, 0);
});

test("listCheckInsForMonth returns only that habit's check-ins for the given month", async () => {
  const service = makeService();
  const habit = await service.createHabit("user-1", { name: "Read", frequency: "DAILY" });

  await service.checkIn(habit.id, "user-1", { year: 1403, month: 2, day: 5 });
  await service.checkIn(habit.id, "user-1", { year: 1403, month: 2, day: 6 });
  await service.checkIn(habit.id, "user-1", { year: 1403, month: 3, day: 1 });

  const checkIns = await service.listCheckInsForMonth(habit.id, "user-1", 1403, 2);
  assert.equal(checkIns.length, 2);
});

test("WEEKLY habit stores its scheduled weekdays", async () => {
  const service = makeService();
  await service.createHabit("user-1", {
    name: "Gym",
    frequency: "WEEKLY",
    weekdays: [1, 3, 5],
  });

  const habits = await service.listHabits("user-1");
  assert.deepEqual(habits[0]?.weekdays, [1, 3, 5]);
});

test("listing N habits costs one check-in query, not N", async () => {
  const { service, checkIns } = makeServiceWithRepos();
  for (let i = 0; i < 12; i++) {
    await service.createHabit("user-1", { name: `Habit ${i}`, frequency: "DAILY" });
  }
  const before = checkIns.queryCount;

  const habits = await service.listHabits("user-1");

  assert.equal(habits.length, 12);
  // The previous implementation called findByHabitId once per habit, so
  // this was 12. The returned streaks were correct either way, which is
  // exactly why only a query count catches the regression.
  assert.equal(checkIns.queryCount - before, 1);
});

test("listHabits issues no check-in query at all when there are no habits", async () => {
  const { service, checkIns } = makeServiceWithRepos();

  const habits = await service.listHabits("user-with-nothing");

  assert.deepEqual(habits, []);
  // `WHERE habitId IN ()` is valid SQL that always returns nothing — a
  // guaranteed-empty round trip on every load of an empty habits screen.
  assert.equal(checkIns.queryCount, 0);
});

test("streaks stay correct per habit when several are batched together", async () => {
  const { service } = makeServiceWithRepos();
  const today = getJalaliDateForInstant(new Date());
  const yesterday = previousJalaliDay(today);

  const streaked = await service.createHabit("user-1", { name: "Two days", frequency: "DAILY" });
  const single = await service.createHabit("user-1", { name: "Today only", frequency: "DAILY" });
  await service.createHabit("user-1", { name: "Never", frequency: "DAILY" });

  await service.checkIn(streaked.id, "user-1", yesterday);
  await service.checkIn(streaked.id, "user-1", today);
  await service.checkIn(single.id, "user-1", today);

  const habits = await service.listHabits("user-1");
  const byName = new Map(habits.map((h) => [h.name, h]));

  // Batching means one result set now feeds every habit's calculation, so
  // the risk it introduces is cross-contamination between habits — each
  // must still see only its own days.
  assert.equal(byName.get("Two days")?.streak, 2);
  assert.equal(byName.get("Today only")?.streak, 1);
  assert.equal(byName.get("Never")?.streak, 0);
  assert.equal(byName.get("Never")?.checkedToday, false);
  assert.equal(byName.get("Today only")?.checkedToday, true);
});

test("a check-in older than the streak lookback window is not loaded", async () => {
  const { service, checkIns } = makeServiceWithRepos();
  const today = getJalaliDateForInstant(new Date());
  const habit = await service.createHabit("user-1", { name: "Ancient", frequency: "DAILY" });

  // Beyond MAX_LOOKBACK_DAYS, so it provably cannot contribute to a streak
  // — which is what makes narrowing the query window lossless rather than
  // a tolerance. Written straight to the fake's rows because checkIn()
  // would be a strange way to express "11 years ago".
  checkIns.rows.push({
    id: "ancient-1",
    habitId: habit.id,
    userId: "user-1",
    jalaliYear: today.year - 11,
    jalaliMonth: 1,
    jalaliDay: 1,
    checkedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
  });

  const habits = await service.listHabits("user-1");
  assert.equal(habits[0]?.streak, 0);
});
