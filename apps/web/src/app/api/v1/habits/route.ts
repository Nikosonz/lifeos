import { HabitCreateInput } from "@lifeos/contracts";
import { habitService } from "@lifeos/core";
import type { HabitWithStatus } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

function toResponse(habit: HabitWithStatus) {
  return {
    id: habit.id,
    userId: habit.userId,
    name: habit.name,
    description: habit.description,
    color: habit.color,
    frequency: habit.frequency,
    weekdays: habit.weekdays,
    streak: habit.streak,
    checkedToday: habit.checkedToday,
    createdAt: habit.createdAt.toISOString(),
    updatedAt: habit.updatedAt.toISOString(),
    deletedAt: habit.deletedAt?.toISOString() ?? null,
    version: habit.version,
  };
}

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = HabitCreateInput.parse(await req.json());
  const habit = await habitService.createHabit(userId, {
    name: input.name,
    frequency: input.frequency,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.weekdays !== undefined ? { weekdays: input.weekdays } : {}),
  });
  return toResponse({ ...habit, streak: 0, checkedToday: false });
});

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const habits = await habitService.listHabits(userId);
  return { habits: habits.map(toResponse) };
});
