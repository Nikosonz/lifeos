import type {
  PrismaClient,
  CalendarEvent,
  CalendarRecurrenceFreq,
} from "../../generated/prisma/index";
import { runVersionedWrite, versionedWhere } from "./optimistic-concurrency";

interface CreateData {
  userId: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  recurrenceFreq?: CalendarRecurrenceFreq | null;
  recurrenceInterval?: number;
  recurrenceCount?: number | null;
  recurrenceUntil?: Date | null;
  recurrenceByWeekday?: number[];
}

interface UpdateData {
  title?: string;
  description?: string | null;
  startAt?: Date;
  endAt?: Date;
  allDay?: boolean;
  recurrenceFreq?: CalendarRecurrenceFreq | null;
  recurrenceInterval?: number;
  recurrenceCount?: number | null;
  recurrenceUntil?: Date | null;
  recurrenceByWeekday?: number[];
}

export interface ICalendarEventRepository {
  create(data: CreateData): Promise<CalendarEvent>;
  findById(id: string): Promise<CalendarEvent | null>;
  update(id: string, data: UpdateData, expectedVersion?: number): Promise<CalendarEvent>;
  softDelete(id: string, expectedVersion?: number): Promise<CalendarEvent>;
  findNonRecurringInRange(userId: string, range: { gte: Date; lt: Date }): Promise<CalendarEvent[]>;
  findRecurringForUser(userId: string): Promise<CalendarEvent[]>;
}

export class CalendarEventRepository implements ICalendarEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreateData) {
    return this.prisma.calendarEvent.create({ data });
  }

  findById(id: string) {
    return this.prisma.calendarEvent.findUnique({ where: { id } });
  }

  update(id: string, data: UpdateData, expectedVersion?: number) {
    return runVersionedWrite(
      () =>
        this.prisma.calendarEvent.update({
          where: versionedWhere(id, expectedVersion),
          data: { ...data, version: { increment: 1 } },
        }),
      () => this.prisma.calendarEvent.findUnique({ where: { id }, select: { version: true } }),
    );
  }

  softDelete(id: string, expectedVersion?: number) {
    return runVersionedWrite(
      () =>
        this.prisma.calendarEvent.update({
          where: versionedWhere(id, expectedVersion),
          data: { deletedAt: new Date(), version: { increment: 1 } },
        }),
      () => this.prisma.calendarEvent.findUnique({ where: { id }, select: { version: true } }),
    );
  }

  // Overlap-based, not start-based: an event that started before `gte` but
  // ends after it is still "in range" for part of the window — see
  // packages/core/src/calendar/recurrence.ts for why the recurring-event
  // path needs the same overlap logic applied in-process instead of SQL.
  findNonRecurringInRange(userId: string, range: { gte: Date; lt: Date }) {
    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        deletedAt: null,
        recurrenceFreq: null,
        startAt: { lt: range.lt },
        endAt: { gt: range.gte },
      },
      orderBy: { startAt: "asc" },
    });
  }

  // Deliberately unconditional (no startAt filter): a recurring event
  // created years ago can still produce valid occurrences in any future
  // range, so it can't be pre-filtered by SQL — expansion happens
  // in-process in CalendarEventService.
  findRecurringForUser(userId: string) {
    return this.prisma.calendarEvent.findMany({
      where: { userId, deletedAt: null, recurrenceFreq: { not: null } },
    });
  }
}
