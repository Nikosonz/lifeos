import type { TaskWithLabels } from "@lifeos/core";

export function toResponse(task: TaskWithLabels) {
  return {
    id: task.id,
    userId: task.userId,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    position: task.position,
    labelIds: task.labels.map((label) => label.id),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    deletedAt: task.deletedAt?.toISOString() ?? null,
    version: task.version,
  };
}
