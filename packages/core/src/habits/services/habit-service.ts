import type {
  IHabitRepository,
  IHabitCheckInRepository,
  IAuditLogRepository,
  Habit,
  HabitCheckIn,
  HabitFrequency,
} from "@lifeos/db";
import { getJalaliDateForInstant } from "../../shared/jalali";
import { calculateStreak, type JalaliCalendarDate } from "../streak";
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
    const today = getJalaliDateForInstant(new Date());
    return Promise.all(habits.map((habit) => this.withStatus(habit, today)));
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
  ): Promise<HabitWithStatus> {
    const updated = await this.crud.update(id, userId, data);
    return this.withStatus(updated, getJalaliDateForInstant(new Date()));
  }

  deleteHabit(id: string, userId: string): Promise<void> {
    return this.crud.delete(id, userId);
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

  private async withStatus(habit: Habit, today: JalaliCalendarDate): Promise<HabitWithStatus> {
    const checkedDays = await this.checkInRepository.findByHabitId(habit.id);
    const streak = calculateStreak(habit, checkedDays, today);
    const checkedToday = checkedDays.some(
      (d) =>
        d.jalaliYear === today.year && d.jalaliMonth === today.month && d.jalaliDay === today.day,
    );
    return { ...habit, streak, checkedToday };
  }
}
