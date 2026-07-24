import type { FinanceCategory } from "@lifeos/core";

export function toResponse(category: FinanceCategory) {
  return {
    id: category.id,
    userId: category.userId,
    name: category.name,
    type: category.type,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    deletedAt: category.deletedAt?.toISOString() ?? null,
    version: category.version,
  };
}
