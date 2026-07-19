import { BudgetUpdateInput } from "@lifeos/contracts";
import { budgetService } from "@lifeos/core";
import type { BudgetWithSpending } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

function toResponse(budget: BudgetWithSpending) {
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

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = BudgetUpdateInput.parse(await req.json());
  await budgetService.updateBudget(id, userId, {
    ...(input.limitAmount !== undefined ? { limitAmount: BigInt(input.limitAmount) } : {}),
  });
  const withSpending = await budgetService.getBudgetWithSpending(id, userId);
  return toResponse(withSpending);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  await budgetService.deleteBudget(id, userId);
  return { ok: true };
});
