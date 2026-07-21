import type { PrismaClient, HabitCheckIn } from "../../generated/prisma/index";

interface DayKey {
  habitId: string;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
}

export interface IHabitCheckInRepository {
  // Upsert on the (habitId, jalaliYear, jalaliMonth, jalaliDay) unique key —
  // creates the row on a first check-in, revives (clears deletedAt) a
  // previously-unchecked day, and is idempotent on a same-day re-check.
  // Never inserts a second row for the same day, since the unique
  // constraint is DB-wide regardless of deletedAt.
  checkIn(data: DayKey & { userId: string; checkedAt: Date }): Promise<HabitCheckIn>;
  // Soft-deletes the row for that day if it exists and isn't already
  // unchecked; no-op (returns null) otherwise.
  uncheck(key: DayKey): Promise<HabitCheckIn | null>;
  // All non-deleted check-ins for a habit, oldest first — the input to
  // streak calculation (see packages/core/src/habits/streak.ts).
  findByHabitId(habitId: string): Promise<HabitCheckIn[]>;
  findByHabitIdAndMonth(
    habitId: string,
    jalaliYear: number,
    jalaliMonth: number,
  ): Promise<HabitCheckIn[]>;
}

export class HabitCheckInRepository implements IHabitCheckInRepository {
  constructor(private readonly prisma: PrismaClient) {}

  checkIn(data: DayKey & { userId: string; checkedAt: Date }) {
    const { habitId, jalaliYear, jalaliMonth, jalaliDay, userId, checkedAt } = data;
    return this.prisma.habitCheckIn.upsert({
      where: {
        habitId_jalaliYear_jalaliMonth_jalaliDay: { habitId, jalaliYear, jalaliMonth, jalaliDay },
      },
      create: { habitId, userId, jalaliYear, jalaliMonth, jalaliDay, checkedAt },
      update: { deletedAt: null, checkedAt, version: { increment: 1 } },
    });
  }

  async uncheck(key: DayKey) {
    const existing = await this.prisma.habitCheckIn.findUnique({
      where: {
        habitId_jalaliYear_jalaliMonth_jalaliDay: key,
      },
    });
    if (!existing || existing.deletedAt) return null;
    return this.prisma.habitCheckIn.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  findByHabitId(habitId: string) {
    return this.prisma.habitCheckIn.findMany({
      where: { habitId, deletedAt: null },
      orderBy: [{ jalaliYear: "asc" }, { jalaliMonth: "asc" }, { jalaliDay: "asc" }],
    });
  }

  findByHabitIdAndMonth(habitId: string, jalaliYear: number, jalaliMonth: number) {
    return this.prisma.habitCheckIn.findMany({
      where: { habitId, jalaliYear, jalaliMonth, deletedAt: null },
      orderBy: { jalaliDay: "asc" },
    });
  }
}
