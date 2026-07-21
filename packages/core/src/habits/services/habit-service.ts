import type {
  IHabitRepository,
  IHabitCheckInRepository,
  IAuditLogRepository,
  Habit,
  HabitCheckIn,
  HabitFrequency,
} from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";
import { getJalaliDateForInstant } from "../../shared/jalali";
import { calculateStreak, type JalaliCalendarDate } from "../streak";

export type HabitWithStatus = Habit & { streak: number; checkedToday: boolean };

export class HabitService {
  constructor(
    private readonly habitRepository: IHabitRepository,
    private readonly checkInRepository: IHabitCheckInRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async createHabit(
    userId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
      frequency: HabitFrequency;
      weekdays?: number[];
    },
  ): Promise<Habit> {
    const habit = await this.habitRepository.create({
      userId,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? null,
      frequency: data.frequency,
      ...(data.weekdays !== undefined ? { weekdays: data.weekdays } : {}),
    });
    await this.auditLogRepository.record({
      userId,
      action: "habits.habit.created",
      metadata: { habitId: habit.id },
    });
    return habit;
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
  ): Promise<Habit> {
    await this.getOwned(id, userId);
    const updated = await this.habitRepository.update(id, data);
    await this.auditLogRepository.record({
      userId,
      action: "habits.habit.updated",
      metadata: { habitId: id },
    });
    return updated;
  }

  async deleteHabit(id: string, userId: string): Promise<void> {
    await this.getOwned(id, userId);
    await this.habitRepository.softDelete(id);
    await this.auditLogRepository.record({
      userId,
      action: "habits.habit.deleted",
      metadata: { habitId: id },
    });
  }

  // `date` defaults to the server's current Jalali day when omitted — a
  // client may also explicitly target a past day (e.g. checking off a day
  // they forgot to mark from a calendar view), which is ordinary user
  // input, not client-side business logic.
  async checkIn(id: string, userId: string, date?: JalaliCalendarDate): Promise<HabitCheckIn> {
    await this.getOwned(id, userId);
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
    await this.getOwned(id, userId);
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
    await this.getOwned(id, userId);
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

  private async getOwned(id: string, userId: string): Promise<Habit> {
    const habit = await this.habitRepository.findById(id);
    if (!habit || habit.userId !== userId || habit.deletedAt) {
      throw new NotFoundError("Habit");
    }
    return habit;
  }
}
