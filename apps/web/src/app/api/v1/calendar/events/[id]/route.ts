import { CalendarEventUpdateInput } from "@lifeos/contracts";
import { calendarEventService } from "@lifeos/core";
import type { CalendarEvent } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

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

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const event = await calendarEventService.getEvent(id, userId);
  return toResponse(event);
});

// Whole-series edit only — no per-occurrence exceptions in v1 (see the
// Calendar module plan's documented scope cut).
export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = CalendarEventUpdateInput.parse(await req.json());
  const event = await calendarEventService.updateEvent(id, userId, {
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
  });
  return toResponse(event);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  await calendarEventService.deleteEvent(id, userId);
  return { ok: true };
});
