import { LabelUpdateInput, VersionedDeleteInput } from "@lifeos/contracts";
import { labelService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { optionalJsonBody } from "@/lib/optional-body";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const label = await labelService.getLabel(id, userId);
  return toResponse(label);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const input = LabelUpdateInput.parse(await req.json());
  const label = await labelService.updateLabel(
    id,
    userId,
    {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
    input.expectedVersion,
  );
  return toResponse(label);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const { expectedVersion } = VersionedDeleteInput.parse(await optionalJsonBody(req));
  await labelService.deleteLabel(id, userId, expectedVersion);
  return { ok: true };
});
