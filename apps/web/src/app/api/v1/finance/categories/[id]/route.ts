import { CategoryUpdateInput } from "@lifeos/contracts";
import { categoryService } from "@lifeos/core";
import type { FinanceCategory } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

function toResponse(category: FinanceCategory) {
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

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = CategoryUpdateInput.parse(await req.json());
  const category = await categoryService.updateCategory(id, userId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
  });
  return toResponse(category);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  await categoryService.deleteCategory(id, userId);
  return { ok: true };
});
