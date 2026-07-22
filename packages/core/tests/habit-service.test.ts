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

function fakeHabitCheckInRepository(): IHabitCheckInRepository & { rows: HabitCheckIn[] } {
  const rows: HabitCheckIn[] = [];
  let seq = 0;
  return {
    rows,
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

function makeService() {
  return new HabitService(
    fakeHabitRepository(),
    fakeHabitCheckInRepository(),
    fakeAuditLogRepository(),
  );
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
