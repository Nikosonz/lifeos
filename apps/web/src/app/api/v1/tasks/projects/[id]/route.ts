import { ProjectUpdateInput } from "@lifeos/contracts";
import { projectService } from "@lifeos/core";
import type { TaskProject } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

function toResponse(project: TaskProject) {
  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description,
    color: project.color,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    deletedAt: project.deletedAt?.toISOString() ?? null,
    version: project.version,
  };
}

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const project = await projectService.getProject(id, userId);
  return toResponse(project);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = ProjectUpdateInput.parse(await req.json());
  const project = await projectService.updateProject(id, userId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
  });
  return toResponse(project);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  await projectService.deleteProject(id, userId);
  return { ok: true };
});
