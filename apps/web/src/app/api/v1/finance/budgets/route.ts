import { BudgetCreateInput, BudgetListQuery } from "@lifeos/contracts";
import { budgetService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "./to-response";

export const POST = defineRoute({ body: BudgetCreateInput }, async ({ userId, body: input }) => {
  const budget = await budgetService.createOrUpdateBudget(userId, {
    categoryId: input.categoryId,
    jalaliYear: input.jalaliYear,
    jalaliMonth: input.jalaliMonth,
    limitAmount: BigInt(input.limitAmount),
    currency: input.currency,
  });
  const withSpending = await budgetService.getBudgetWithSpending(budget.id, userId);
  return toResponse(withSpending);
});

export const GET = defineRoute({}, async ({ userId, req }) => {
  const query = BudgetListQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const budgets = await budgetService.listWithSpending(userId, query.jalaliYear, query.jalaliMonth);
  return { budgets: budgets.map(toResponse) };
});
