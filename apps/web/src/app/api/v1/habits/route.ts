import { HabitCreateInput } from "@lifeos/contracts";
import { habitService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "./to-response";

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
