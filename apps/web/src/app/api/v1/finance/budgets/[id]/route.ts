import {
  BudgetUpdateInput,
  VersionedDeleteInput,
  BudgetResponse,
  OkResponse,
} from "@lifeos/contracts";
import { budgetService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const PATCH = defineRoute(
  { params: ["id"], body: BudgetUpdateInput, response: BudgetResponse },
  async ({ userId, params, body: input }) => {
    const { id } = params;
    await budgetService.updateBudget(
      id,
      userId,
      {
        ...(input.limitAmount !== undefined ? { limitAmount: BigInt(input.limitAmount) } : {}),
      },
      input.expectedVersion,
    );
    const withSpending = await budgetService.getBudgetWithSpending(id, userId);
    return toResponse(withSpending);
  },
);

export const DELETE = defineRoute(
  { params: ["id"], body: VersionedDeleteInput, response: OkResponse },
  async ({ userId, params, body: { expectedVersion } }) => {
    const { id } = params;
    await budgetService.deleteBudget(id, userId, expectedVersion);
    return { ok: true };
  },
);
