import type { ICalendarEventRepository, IAuditLogRepository, CalendarEvent } from "@lifeos/db";
import { OwnedResourceCrud } from "../../shared/owned-resource-crud";
import { expandOccurrencesInRange } from "../recurrence";
import type { RecurrenceFreq } from "../recurrence";

export interface CreateCalendarEventInput {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  allDay?: boolean;
  recurrenceFreq?: RecurrenceFreq | null;
  recurrenceInterval?: number;
  recurrenceCount?: number | null;
  recurrenceUntil?: Date | null;
  recurrenceByWeekday?: number[];
}

export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>;

export interface Occurrence {
  eventId: string;
  title: string;
  occurrenceStart: Date;
  occurrenceEnd: Date;
  allDay: boolean;
  isRecurring: boolean;
}

export class CalendarEventService {
  private readonly crud: OwnedResourceCrud<
    CalendarEvent,
    Parameters<ICalendarEventRepository["create"]>[0],
    Parameters<ICalendarEventRepository["update"]>[1]
  >;

  constructor(
    private readonly eventRepository: ICalendarEventRepository,
    auditLogRepository: IAuditLogRepository,
  ) {
    this.crud = new OwnedResourceCrud(eventRepository, auditLogRepository, {
      entityName: "Event",
      actionPrefix: "calendar.event",
    });
  }

  createEvent(userId: string, data: CreateCalendarEventInput): Promise<CalendarEvent> {
    return this.crud.create({
      userId,
      title: data.title,
      description: data.description ?? null,
      startAt: data.startAt,
      endAt: data.endAt,
      allDay: data.allDay ?? false,
      recurrenceFreq: data.recurrenceFreq ?? null,
      recurrenceInterval: data.recurrenceInterval ?? 1,
      recurrenceCount: data.recurrenceCount ?? null,
      recurrenceUntil: data.recurrenceUntil ?? null,
      recurrenceByWeekday: data.recurrenceByWeekday ?? [],
    });
  }

  getEvent(id: string, userId: string): Promise<CalendarEvent> {
    return this.crud.getOwned(id, userId);
  }

  updateEvent(id: string, userId: string, data: UpdateCalendarEventInput): Promise<CalendarEvent> {
    return this.crud.update(id, userId, {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.startAt !== undefined ? { startAt: data.startAt } : {}),
      ...(data.endAt !== undefined ? { endAt: data.endAt } : {}),
      ...(data.allDay !== undefined ? { allDay: data.allDay } : {}),
      ...(data.recurrenceFreq !== undefined ? { recurrenceFreq: data.recurrenceFreq } : {}),
      ...(data.recurrenceInterval !== undefined
        ? { recurrenceInterval: data.recurrenceInterval }
        : {}),
      ...(data.recurrenceCount !== undefined ? { recurrenceCount: data.recurrenceCount } : {}),
      ...(data.recurrenceUntil !== undefined ? { recurrenceUntil: data.recurrenceUntil } : {}),
      ...(data.recurrenceByWeekday !== undefined
        ? { recurrenceByWeekday: data.recurrenceByWeekday }
        : {}),
    });
  }

  deleteEvent(id: string, userId: string): Promise<void> {
    return this.crud.delete(id, userId);
  }

  // Own events only, occurrence-expanded — GET /calendar/events. AgendaService
  // composes this with Task deadlines and holidays for GET /calendar/agenda.
  async listOccurrencesInRange(
    userId: string,
    range: { gte: Date; lt: Date },
  ): Promise<Occurrence[]> {
    const [nonRecurring, recurring] = await Promise.all([
      this.eventRepository.findNonRecurringInRange(userId, range),
      this.eventRepository.findRecurringForUser(userId),
    ]);

    const occurrences: Occurrence[] = nonRecurring.map((event) => ({
      eventId: event.id,
      title: event.title,
      occurrenceStart: event.startAt,
      occurrenceEnd: event.endAt,
      allDay: event.allDay,
      isRecurring: false,
    }));

    for (const event of recurring) {
      if (!event.recurrenceFreq) continue;
      const expanded = expandOccurrencesInRange(
        {
          startAt: event.startAt,
          endAt: event.endAt,
          recurrenceFreq: event.recurrenceFreq,
          recurrenceInterval: event.recurrenceInterval,
          recurrenceCount: event.recurrenceCount,
          recurrenceUntil: event.recurrenceUntil,
          recurrenceByWeekday: event.recurrenceByWeekday,
        },
        range,
      );
      for (const occ of expanded) {
        occurrences.push({
          eventId: event.id,
          title: event.title,
          occurrenceStart: occ.start,
          occurrenceEnd: occ.end,
          allDay: event.allDay,
          isRecurring: true,
        });
      }
    }

    return occurrences.sort((a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime());
  }
}
