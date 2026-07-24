import { BudgetCreateInput, BudgetListQuery } from "@lifeos/contracts";
import { budgetService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "./to-response";

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = BudgetCreateInput.parse(await req.json());
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

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const query = BudgetListQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const budgets = await budgetService.listWithSpending(userId, query.jalaliYear, query.jalaliMonth);
  return { budgets: budgets.map(toResponse) };
});
