import { CalendarEventCreateInput, CalendarRangeQuery } from "@lifeos/contracts";
import { calendarEventService } from "@lifeos/core";
import type { Occurrence } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { resolveRangeQuery } from "@/lib/calendar-range";
import { toResponse } from "./to-response";

function toOccurrenceResponse(occ: Occurrence) {
  return {
    eventId: occ.eventId,
    title: occ.title,
    occurrenceStart: occ.occurrenceStart.toISOString(),
    occurrenceEnd: occ.occurrenceEnd.toISOString(),
    allDay: occ.allDay,
    isRecurring: occ.isRecurring,
    version: occ.version,
  };
}

export const POST = defineRoute(
  { body: CalendarEventCreateInput },
  async ({ userId, body: input }) => {
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
  },
);

// Own events only, occurrence-expanded — see /calendar/agenda for the
// merged events+tasks+holidays view.
export const GET = defineRoute({}, async ({ userId, req }) => {
  const query = CalendarRangeQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const range = resolveRangeQuery(query);
  const occurrences = await calendarEventService.listOccurrencesInRange(userId, range);
  return {
    from: range.gte.toISOString(),
    to: range.lt.toISOString(),
    items: occurrences.map(toOccurrenceResponse),
  };
});
