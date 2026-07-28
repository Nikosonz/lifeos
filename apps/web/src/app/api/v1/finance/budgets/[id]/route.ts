import { BudgetUpdateInput } from "@lifeos/contracts";
import { budgetService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const input = BudgetUpdateInput.parse(await req.json());
  await budgetService.updateBudget(id, userId, {
    ...(input.limitAmount !== undefined ? { limitAmount: BigInt(input.limitAmount) } : {}),
  });
  const withSpending = await budgetService.getBudgetWithSpending(id, userId);
  return toResponse(withSpending);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  await budgetService.deleteBudget(id, userId);
  return { ok: true };
});
