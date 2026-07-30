import { CalendarEventUpdateInput, VersionedDeleteInput } from "@lifeos/contracts";
import { calendarEventService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const GET = defineRoute({ params: ["id"] }, async ({ userId, params }) => {
  const { id } = params;
  const event = await calendarEventService.getEvent(id, userId);
  return toResponse(event);
});

// Whole-series edit only — no per-occurrence exceptions in v1 (see the
// Calendar module plan's documented scope cut).
export const PATCH = defineRoute(
  { params: ["id"], body: CalendarEventUpdateInput },
  async ({ userId, params, body: input }) => {
    const { id } = params;
    const event = await calendarEventService.updateEvent(
      id,
      userId,
      {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startAt !== undefined ? { startAt: new Date(input.startAt) } : {}),
        ...(input.endAt !== undefined ? { endAt: new Date(input.endAt) } : {}),
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
      },
      input.expectedVersion,
    );
    return toResponse(event);
  },
);

export const DELETE = defineRoute(
  { params: ["id"], body: VersionedDeleteInput },
  async ({ userId, params, body: { expectedVersion } }) => {
    const { id } = params;
    await calendarEventService.deleteEvent(id, userId, expectedVersion);
    return { ok: true };
  },
);
