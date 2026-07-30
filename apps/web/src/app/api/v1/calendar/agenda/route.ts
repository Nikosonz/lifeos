import { CalendarRangeQuery, CalendarAgendaResponse } from "@lifeos/contracts";
import { agendaService } from "@lifeos/core";
import type { CalendarItem } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { resolveRangeQuery } from "@/lib/calendar-range";

function toItemResponse(item: CalendarItem) {
  const base = {
    title: item.title,
    start: item.start.toISOString(),
    end: item.end.toISOString(),
    allDay: item.allDay,
  };
  switch (item.source) {
    case "event":
      return {
        source: "event" as const,
        ...base,
        eventId: item.eventId,
        isRecurring: item.isRecurring,
        version: item.version,
      };
    case "task":
      return {
        source: "task" as const,
        ...base,
        taskId: item.taskId,
        status: item.status,
        priority: item.priority,
      };
    case "holiday":
      return {
        source: "holiday" as const,
        ...base,
        jalaliYear: item.jalaliYear,
        jalaliMonth: item.jalaliMonth,
        jalaliDay: item.jalaliDay,
      };
  }
}

// Merges own events + Task deadlines + holidays into one discriminated-union
// timeline. GET /calendar/events stays REST-pure (events only) — see the
// Calendar module plan for why these are two separate endpoints.
export const GET = defineRoute(
  { query: CalendarRangeQuery, response: CalendarAgendaResponse },
  async ({ userId, query }) => {
    const range = resolveRangeQuery(query);
    const items = await agendaService.listAgendaInRange(userId, range);
    return {
      from: range.gte.toISOString(),
      to: range.lt.toISOString(),
      items: items.map(toItemResponse),
    };
  },
);
