import { Currency } from "@lifeos/contracts";
import type { BudgetResponse } from "@lifeos/contracts";
import type { BudgetWithSpending } from "@lifeos/core";

// `currency` is the one field the database cannot type for us: the Prisma
// column is a plain `String`, while the contract declares `Currency`
// (`z.enum(["IRR"])`). Nothing checked that they agreed until routes started
// declaring `response`, at which point the mismatch became a compile error
// here rather than a wrong value on the wire. Parsing it — rather than casting
// — means a row holding anything else fails at the mapping boundary, naming
// the field, instead of producing a response no client can parse.
export function toResponse(budget: BudgetWithSpending): BudgetResponse {
  return {
    id: budget.id,
    userId: budget.userId,
    categoryId: budget.categoryId,
    jalaliYear: budget.jalaliYear,
    jalaliMonth: budget.jalaliMonth,
    limitAmount: budget.limitAmount.toString(),
    currency: Currency.parse(budget.currency),
    spent: budget.spent.toString(),
    remaining: budget.remaining.toString(),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    deletedAt: budget.deletedAt?.toISOString() ?? null,
    version: budget.version,
  };
}
