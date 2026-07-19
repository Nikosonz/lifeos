import { LabelUpdateInput } from "@lifeos/contracts";
import { labelService } from "@lifeos/core";
import type { TaskLabel } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

function toResponse(label: TaskLabel) {
  return {
    id: label.id,
    userId: label.userId,
    name: label.name,
    color: label.color,
    createdAt: label.createdAt.toISOString(),
    updatedAt: label.updatedAt.toISOString(),
    deletedAt: label.deletedAt?.toISOString() ?? null,
    version: label.version,
  };
}

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const label = await labelService.getLabel(id, userId);
  return toResponse(label);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = LabelUpdateInput.parse(await req.json());
  const label = await labelService.updateLabel(id, userId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
  });
  return toResponse(label);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  await labelService.deleteLabel(id, userId);
  return { ok: true };
});
