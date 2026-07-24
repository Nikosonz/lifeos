import type { Subtask } from "@lifeos/core";

export function toResponse(subtask: Subtask) {
  return {
    id: subtask.id,
    taskId: subtask.taskId,
    userId: subtask.userId,
    title: subtask.title,
    completed: subtask.completed,
    position: subtask.position,
    createdAt: subtask.createdAt.toISOString(),
    updatedAt: subtask.updatedAt.toISOString(),
    deletedAt: subtask.deletedAt?.toISOString() ?? null,
    version: subtask.version,
  };
}
