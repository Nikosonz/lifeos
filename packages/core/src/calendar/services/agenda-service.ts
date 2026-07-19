import type { ITaskRepository, TaskStatus, TaskPriority } from "@lifeos/db";
import { getJalaliYearMonthForInstant } from "../../shared/jalali";
import { getHolidaysForJalaliYear } from "../holidays";
import type { CalendarEventService } from "./calendar-event-service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CalendarEventItem {
  source: "event";
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  eventId: string;
  isRecurring: boolean;
}

export interface CalendarTaskItem {
  source: "task";
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  taskId: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface CalendarHolidayItem {
  source: "holiday";
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
}

export type CalendarItem = CalendarEventItem | CalendarTaskItem | CalendarHolidayItem;

// Composes CalendarEventService's own occurrences with Task deadlines
// (read-only, via ITaskRepository directly — none of Task's business rules
// apply to displaying a deadline) and the static holiday table into one
// chronologically-sorted timeline. Mirrors DashboardService's shape: a mix
// of sibling services and raw repositories, no mutation, no audit logging.
export class AgendaService {
  constructor(
    private readonly calendarEventService: CalendarEventService,
    private readonly taskRepository: ITaskRepository,
  ) {}

  async listAgendaInRange(userId: string, range: { gte: Date; lt: Date }): Promise<CalendarItem[]> {
    const [occurrences, tasks] = await Promise.all([
      this.calendarEventService.listOccurrencesInRange(userId, range),
      this.taskRepository.findByUserIdWithDeadlineInRange(userId, range),
    ]);

    const items: CalendarItem[] = [];

    for (const occ of occurrences) {
      items.push({
        source: "event",
        title: occ.title,
        start: occ.occurrenceStart,
        end: occ.occurrenceEnd,
        allDay: occ.allDay,
        eventId: occ.eventId,
        isRecurring: occ.isRecurring,
      });
    }

    for (const task of tasks) {
      if (!task.deadline) continue;
      items.push({
        source: "task",
        title: task.title,
        start: task.deadline,
        end: task.deadline,
        allDay: false,
        taskId: task.id,
        status: task.status,
        priority: task.priority,
      });
    }

    // A query range can span a Jalali new-year boundary, so both endpoints'
    // Jalali years are checked (usually the same year, sometimes adjacent).
    const yearsToCheck = new Set([
      getJalaliYearMonthForInstant(range.gte).year,
      getJalaliYearMonthForInstant(new Date(range.lt.getTime() - 1)).year,
    ]);
    for (const year of yearsToCheck) {
      for (const holiday of getHolidaysForJalaliYear(year)) {
        const holidayEnd = new Date(holiday.date.getTime() + MS_PER_DAY);
        if (holiday.date < range.lt && holidayEnd > range.gte) {
          items.push({
            source: "holiday",
            title: holiday.name,
            start: holiday.date,
            end: holidayEnd,
            allDay: true,
            jalaliYear: holiday.jalaliYear,
            jalaliMonth: holiday.jalaliMonth,
            jalaliDay: holiday.jalaliDay,
          });
        }
      }
    }

    return items.sort((a, b) => a.start.getTime() - b.start.getTime());
  }
}
