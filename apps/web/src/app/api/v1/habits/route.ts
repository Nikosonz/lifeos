import { HabitCreateInput } from "@lifeos/contracts";
import { habitService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "./to-response";

export const POST = defineRoute({ body: HabitCreateInput }, async ({ userId, body: input }) => {
  const habit = await habitService.createHabit(userId, {
    name: input.name,
    frequency: input.frequency,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.weekdays !== undefined ? { weekdays: input.weekdays } : {}),
  });
  return toResponse({ ...habit, streak: 0, checkedToday: false });
});

export const GET = defineRoute({}, async ({ userId }) => {
  const habits = await habitService.listHabits(userId);
  return { habits: habits.map(toResponse) };
});
