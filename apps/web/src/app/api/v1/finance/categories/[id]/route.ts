import { CategoryUpdateInput, VersionedDeleteInput } from "@lifeos/contracts";
import { categoryService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { optionalJsonBody } from "@/lib/optional-body";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const input = CategoryUpdateInput.parse(await req.json());
  const category = await categoryService.updateCategory(
    id,
    userId,
    {
      ...(input.name !== undefined ? { name: input.name } : {}),
    },
    input.expectedVersion,
  );
  return toResponse(category);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const { expectedVersion } = VersionedDeleteInput.parse(await optionalJsonBody(req));
  await categoryService.deleteCategory(id, userId, expectedVersion);
  return { ok: true };
});
