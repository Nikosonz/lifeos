import type { HabitWithStatus } from "@lifeos/core";

export function toResponse(habit: HabitWithStatus) {
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
