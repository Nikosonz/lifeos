import { HabitUpdateInput } from "@lifeos/contracts";
import { habitService } from "@lifeos/core";
import type { Habit } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

function toResponse(habit: Habit) {
  return {
    id: habit.id,
    userId: habit.userId,
    name: habit.name,
    description: habit.description,
    color: habit.color,
    frequency: habit.frequency,
    weekdays: habit.weekdays,
    createdAt: habit.createdAt.toISOString(),
    updatedAt: habit.updatedAt.toISOString(),
    deletedAt: habit.deletedAt?.toISOString() ?? null,
    version: habit.version,
  };
}

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = HabitUpdateInput.parse(await req.json());
  const habit = await habitService.updateHabit(id, userId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
    ...(input.weekdays !== undefined ? { weekdays: input.weekdays } : {}),
  });
  return toResponse(habit);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  await habitService.deleteHabit(id, userId);
  return { ok: true };
});
