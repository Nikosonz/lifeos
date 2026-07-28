import { CalendarEventUpdateInput } from "@lifeos/contracts";
import { calendarEventService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const event = await calendarEventService.getEvent(id, userId);
  return toResponse(event);
});

// Whole-series edit only — no per-occurrence exceptions in v1 (see the
// Calendar module plan's documented scope cut).
export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
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
  const { id } = await uuidParams(ctx.params);
  await calendarEventService.deleteEvent(id, userId);
  return { ok: true };
});
