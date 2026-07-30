import { ProjectUpdateInput, VersionedDeleteInput } from "@lifeos/contracts";
import { projectService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { optionalJsonBody } from "@/lib/optional-body";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const project = await projectService.getProject(id, userId);
  return toResponse(project);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const input = ProjectUpdateInput.parse(await req.json());
  const project = await projectService.updateProject(
    id,
    userId,
    {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
    input.expectedVersion,
  );
  return toResponse(project);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const { expectedVersion } = VersionedDeleteInput.parse(await optionalJsonBody(req));
  await projectService.deleteProject(id, userId, expectedVersion);
  return { ok: true };
});
