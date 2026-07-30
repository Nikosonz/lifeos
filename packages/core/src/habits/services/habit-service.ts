import type {
  IHabitRepository,
  IHabitCheckInRepository,
  IAuditLogRepository,
  Habit,
  HabitCheckIn,
  HabitFrequency,
} from "@lifeos/db";
import { addJalaliDays, getJalaliDateForInstant } from "../../shared/jalali";
import {
  calculateStreak,
  MAX_LOOKBACK_DAYS,
  type CheckedDay,
  type JalaliCalendarDate,
} from "../streak";
import { OwnedResourceCrud } from "../../shared/owned-resource-crud";

export type HabitWithStatus = Habit & { streak: number; checkedToday: boolean };

export class HabitService {
  private readonly crud: OwnedResourceCrud<
    Habit,
    Parameters<IHabitRepository["create"]>[0],
    Parameters<IHabitRepository["update"]>[1]
  >;

  constructor(
    private readonly habitRepository: IHabitRepository,
    private readonly checkInRepository: IHabitCheckInRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {
    this.crud = new OwnedResourceCrud(habitRepository, auditLogRepository, {
      entityName: "Habit",
      actionPrefix: "habits.habit",
    });
  }

  createHabit(
    userId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
      frequency: HabitFrequency;
      weekdays?: number[];
    },
  ): Promise<Habit> {
    return this.crud.create({
      userId,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? null,
      frequency: data.frequency,
      ...(data.weekdays !== undefined ? { weekdays: data.weekdays } : {}),
    });
  }

  async listHabits(userId: string): Promise<HabitWithStatus[]> {
    const habits = await this.habitRepository.findByUserId(userId);
    return this.withStatusMany(habits, getJalaliDateForInstant(new Date()));
  }

  async updateHabit(
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string | null;
      color?: string | null;
      frequency?: HabitFrequency;
      weekdays?: number[];
    },
    expectedVersion?: number,
  ): Promise<HabitWithStatus> {
    const updated = await this.crud.update(id, userId, data, expectedVersion);
    const [withStatus] = await this.withStatusMany([updated], getJalaliDateForInstant(new Date()));
    return withStatus!;
  }

  deleteHabit(id: string, userId: string, expectedVersion?: number): Promise<void> {
    return this.crud.delete(id, userId, expectedVersion);
  }

  // `date` defaults to the server's current Jalali day when omitted — a
  // client may also explicitly target a past day (e.g. checking off a day
  // they forgot to mark from a calendar view), which is ordinary user
  // input, not client-side business logic. This audit trail
  // (habits.checkin.*) is a different resource than the habit itself, so it
  // reuses only crud.getOwned for the ownership check, never crud.audit —
  // its own metadata shape ({habitId, jalaliYear, jalaliMonth, jalaliDay})
  // doesn't fit the single-key auto-derivation anyway.
  async checkIn(id: string, userId: string, date?: JalaliCalendarDate): Promise<HabitCheckIn> {
    await this.crud.getOwned(id, userId);
    const target = date ?? getJalaliDateForInstant(new Date());
    const checkIn = await this.checkInRepository.checkIn({
      habitId: id,
      userId,
      jalaliYear: target.year,
      jalaliMonth: target.month,
      jalaliDay: target.day,
      checkedAt: new Date(),
    });
    await this.auditLogRepository.record({
      userId,
      action: "habits.checkin.created",
      metadata: { habitId: id, ...target },
    });
    return checkIn;
  }

  async uncheck(id: string, userId: string, date?: JalaliCalendarDate): Promise<void> {
    await this.crud.getOwned(id, userId);
    const target = date ?? getJalaliDateForInstant(new Date());
    await this.checkInRepository.uncheck({
      habitId: id,
      jalaliYear: target.year,
      jalaliMonth: target.month,
      jalaliDay: target.day,
    });
    await this.auditLogRepository.record({
      userId,
      action: "habits.checkin.deleted",
      metadata: { habitId: id, ...target },
    });
  }

  async listCheckInsForMonth(
    id: string,
    userId: string,
    jalaliYear: number,
    jalaliMonth: number,
  ): Promise<HabitCheckIn[]> {
    await this.crud.getOwned(id, userId);
    return this.checkInRepository.findByHabitIdAndMonth(id, jalaliYear, jalaliMonth);
  }

  /**
   * Attaches streak + checkedToday to any number of habits using exactly
   * ONE check-in query, regardless of how many habits there are.
   *
   * This replaced a per-habit `findByHabitId` call. That shape cost N+1
   * queries to list N habits, and each of those N returned the habit's
   * *entire lifetime* check-in history — for a user with 20 habits after
   * two years, roughly 14,600 rows fetched to produce 20 integers and 20
   * booleans. Cost grew with account age, so it degraded fastest for the
   * most engaged users.
   *
   * The window is derived from MAX_LOOKBACK_DAYS rather than picked: the
   * streak walk provably never looks further back than that, so no check-in
   * outside the window can change any result. Narrowing here is lossless,
   * not a tolerance.
   */
  private async withStatusMany(
    habits: Habit[],
    today: JalaliCalendarDate,
  ): Promise<HabitWithStatus[]> {
    if (habits.length === 0) return [];

    const since = addJalaliDays(today, -MAX_LOOKBACK_DAYS);
    const rows = await this.checkInRepository.findCheckedDaysForHabits(
      habits.map((habit) => habit.id),
      { jalaliYear: since.year, jalaliMonth: since.month, jalaliDay: since.day },
    );

    const byHabit = new Map<string, CheckedDay[]>();
    for (const row of rows) {
      const existing = byHabit.get(row.habitId);
      if (existing) existing.push(row);
      else byHabit.set(row.habitId, [row]);
    }

    return habits.map((habit) => {
      const checkedDays = byHabit.get(habit.id) ?? [];
      return {
        ...habit,
        streak: calculateStreak(habit, checkedDays, today),
        checkedToday: checkedDays.some(
          (d) =>
            d.jalaliYear === today.year &&
            d.jalaliMonth === today.month &&
            d.jalaliDay === today.day,
        ),
      };
    });
  }
}
