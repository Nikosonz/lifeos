import type { PrismaClient, HabitCheckIn } from "../../generated/prisma/index";

interface DayKey {
  habitId: string;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
}

/** A Jalali calendar date, as the three columns actually stored. */
export interface JalaliDayKey {
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
}

/**
 * The only fields streak calculation consumes. Deliberately narrower than
 * HabitCheckIn: the streak walk is pure set membership over calendar days,
 * so selecting the full row would ship id/userId/checkedAt/createdAt/
 * updatedAt/deletedAt/version for every check-in a user has ever made to
 * compute one integer per habit.
 */
export interface HabitCheckedDay {
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
  /**
   * Checked days for MANY habits in one query, from `since` (inclusive)
   * onward. Replaces a per-habit findByHabitId loop that made listing N
   * habits cost N+1 queries, each returning that habit's entire lifetime
   * history.
   *
   * `since` is a Jalali calendar date, not a `checkedAt` instant, and that
   * distinction is load-bearing: a backfilled check-in stores `checkedAt =
   * now()` while its jalali* columns point at the day being backfilled (see
   * HabitService.checkIn). Filtering on `checkedAt` would therefore include
   * days outside the window and exclude days inside it.
   */
  findCheckedDaysForHabits(habitIds: string[], since: JalaliDayKey): Promise<HabitCheckedDay[]>;
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

  async findCheckedDaysForHabits(
    habitIds: string[],
    since: JalaliDayKey,
  ): Promise<HabitCheckedDay[]> {
    // `in: []` would be valid SQL but a pointless round trip.
    if (habitIds.length === 0) return [];
    const { jalaliYear, jalaliMonth, jalaliDay } = since;
    return this.prisma.habitCheckIn.findMany({
      where: {
        habitId: { in: habitIds },
        deletedAt: null,
        // Lexicographic (year, month, day) >= since. The three parts are
        // separate integer columns, so there is no single comparable value
        // to range over — this is the standard three-branch expansion, and
        // it is why the bound is a tuple rather than one column.
        OR: [
          { jalaliYear: { gt: jalaliYear } },
          { jalaliYear, jalaliMonth: { gt: jalaliMonth } },
          { jalaliYear, jalaliMonth, jalaliDay: { gte: jalaliDay } },
        ],
      },
      // No orderBy: calculateStreak builds a Set and tests membership, so
      // ordering would be sorting work the consumer discards.
      select: { habitId: true, jalaliYear: true, jalaliMonth: true, jalaliDay: true },
    });
  }
}
