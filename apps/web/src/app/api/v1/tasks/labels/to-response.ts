import type { TaskLabel } from "@lifeos/core";

export function toResponse(label: TaskLabel) {
  return {
    id: label.id,
    userId: label.userId,
    name: label.name,
    color: label.color,
    createdAt: label.createdAt.toISOString(),
    updatedAt: label.updatedAt.toISOString(),
    deletedAt: label.deletedAt?.toISOString() ?? null,
    version: label.version,
  };
}
