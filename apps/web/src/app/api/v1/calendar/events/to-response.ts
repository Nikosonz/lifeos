import type { CalendarEvent } from "@lifeos/core";

export function toResponse(event: CalendarEvent) {
  return {
    id: event.id,
    userId: event.userId,
    title: event.title,
    description: event.description,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    allDay: event.allDay,
    recurrenceFreq: event.recurrenceFreq,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceCount: event.recurrenceCount,
    recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
    recurrenceByWeekday: event.recurrenceByWeekday,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    deletedAt: event.deletedAt?.toISOString() ?? null,
    version: event.version,
  };
}
