import { ProjectUpdateInput, VersionedDeleteInput } from "@lifeos/contracts";
import { projectService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const GET = defineRoute({ params: ["id"] }, async ({ userId, params }) => {
  const { id } = params;
  const project = await projectService.getProject(id, userId);
  return toResponse(project);
});

export const PATCH = defineRoute(
  { params: ["id"], body: ProjectUpdateInput },
  async ({ userId, params, body: input }) => {
    const { id } = params;
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
  },
);

export const DELETE = defineRoute(
  { params: ["id"], body: VersionedDeleteInput },
  async ({ userId, params, body: { expectedVersion } }) => {
    const { id } = params;
    await projectService.deleteProject(id, userId, expectedVersion);
    return { ok: true };
  },
);
