import type { TaskProject } from "@lifeos/core";

export function toResponse(project: TaskProject) {
  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description,
    color: project.color,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    deletedAt: project.deletedAt?.toISOString() ?? null,
    version: project.version,
  };
}
