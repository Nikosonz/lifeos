import {
  CalendarEventResponse,
  CalendarEventCreateInput,
  CalendarEventUpdateInput,
  CalendarAgendaResponse,
  OkResponse,
} from "@lifeos/contracts";
import { apiFetch } from "./api-client";
import type { Versioned } from "./api-client";

// Range param shape accepted by both /calendar/events and /calendar/agenda —
// either {from,to} (ISO instants) or {jalaliYear,jalaliMonth}, mutually
// exclusive, matching CalendarRangeQuery (packages/contracts/src/calendar/schemas.ts).
type RangeParams = { from: string; to: string } | { jalaliYear: number; jalaliMonth: number };

export const calendarApi = {
  getAgenda: (range: RangeParams) =>
    apiFetch("/api/v1/calendar/agenda", { query: range, schema: CalendarAgendaResponse }),

  getEvent: (id: string) =>
    apiFetch(`/api/v1/calendar/events/${id}`, { schema: CalendarEventResponse }),
  createEvent: (input: CalendarEventCreateInput) =>
    apiFetch("/api/v1/calendar/events", {
      method: "POST",
      body: input,
      schema: CalendarEventResponse,
    }),
  updateEvent: (id: string, input: Versioned<CalendarEventUpdateInput>) =>
    apiFetch(`/api/v1/calendar/events/${id}`, {
      method: "PATCH",
      body: input,
      schema: CalendarEventResponse,
    }),
  deleteEvent: (id: string, expectedVersion: number) =>
    apiFetch(`/api/v1/calendar/events/${id}`, {
      method: "DELETE",
      body: { expectedVersion },
      schema: OkResponse,
    }),
};
