import { CalendarEventCreateInput, CalendarRangeQuery } from "@lifeos/contracts";
import { calendarEventService } from "@lifeos/core";
import type { CalendarEvent, Occurrence } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { resolveRangeQuery } from "@/lib/calendar-range";

function toResponse(event: CalendarEvent) {
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

function toOccurrenceResponse(occ: Occurrence) {
  return {
    eventId: occ.eventId,
    title: occ.title,
    occurrenceStart: occ.occurrenceStart.toISOString(),
    occurrenceEnd: occ.occurrenceEnd.toISOString(),
    allDay: occ.allDay,
    isRecurring: occ.isRecurring,
  };
}

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = CalendarEventCreateInput.parse(await req.json());
  const event = await calendarEventService.createEvent(userId, {
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    ...(input.allDay !== undefined ? { allDay: input.allDay } : {}),
    ...(input.recurrenceFreq !== undefined ? { recurrenceFreq: input.recurrenceFreq } : {}),
    ...(input.recurrenceInterval !== undefined
      ? { recurrenceInterval: input.recurrenceInterval }
      : {}),
    ...(input.recurrenceCount !== undefined ? { recurrenceCount: input.recurrenceCount } : {}),
    ...(input.recurrenceUntil !== undefined
      ? { recurrenceUntil: new Date(input.recurrenceUntil) }
      : {}),
    ...(input.recurrenceByWeekday !== undefined
      ? { recurrenceByWeekday: input.recurrenceByWeekday }
      : {}),
  });
  return toResponse(event);
});

// Own events only, occurrence-expanded — see /calendar/agenda for the
// merged events+tasks+holidays view.
export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const query = CalendarRangeQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const range = resolveRangeQuery(query);
  const occurrences = await calendarEventService.listOccurrencesInRange(userId, range);
  return {
    from: range.gte.toISOString(),
    to: range.lt.toISOString(),
    items: occurrences.map(toOccurrenceResponse),
  };
});
