import type { BudgetWithSpending } from "@lifeos/core";

export function toResponse(budget: BudgetWithSpending) {
  return {
    id: budget.id,
    userId: budget.userId,
    categoryId: budget.categoryId,
    jalaliYear: budget.jalaliYear,
    jalaliMonth: budget.jalaliMonth,
    limitAmount: budget.limitAmount.toString(),
    currency: budget.currency,
    spent: budget.spent.toString(),
    remaining: budget.remaining.toString(),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    deletedAt: budget.deletedAt?.toISOString() ?? null,
    version: budget.version,
  };
}
