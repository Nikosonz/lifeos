import type { ICalendarEventRepository, IAuditLogRepository, CalendarEvent } from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";
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
  constructor(
    private readonly eventRepository: ICalendarEventRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async createEvent(userId: string, data: CreateCalendarEventInput): Promise<CalendarEvent> {
    const event = await this.eventRepository.create({
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
    await this.auditLogRepository.record({
      userId,
      action: "calendar.event.created",
      metadata: { eventId: event.id },
    });
    return event;
  }

  async getEvent(id: string, userId: string): Promise<CalendarEvent> {
    return this.getOwned(id, userId);
  }

  async updateEvent(
    id: string,
    userId: string,
    data: UpdateCalendarEventInput,
  ): Promise<CalendarEvent> {
    await this.getOwned(id, userId);
    const updated = await this.eventRepository.update(id, {
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
    await this.auditLogRepository.record({
      userId,
      action: "calendar.event.updated",
      metadata: { eventId: id },
    });
    return updated;
  }

  async deleteEvent(id: string, userId: string): Promise<void> {
    await this.getOwned(id, userId);
    await this.eventRepository.softDelete(id);
    await this.auditLogRepository.record({
      userId,
      action: "calendar.event.deleted",
      metadata: { eventId: id },
    });
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

  private async getOwned(id: string, userId: string): Promise<CalendarEvent> {
    const event = await this.eventRepository.findById(id);
    if (!event || event.userId !== userId || event.deletedAt) throw new NotFoundError("Event");
    return event;
  }
}
