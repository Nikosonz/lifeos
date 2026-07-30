import { ProjectCreateInput, ProjectListResponse, ProjectResponse } from "@lifeos/contracts";
import { projectService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "./to-response";

export const POST = defineRoute(
  { body: ProjectCreateInput, response: ProjectResponse },
  async ({ userId, body: input }) => {
    const project = await projectService.createProject(userId, {
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    });
    return toResponse(project);
  },
);

export const GET = defineRoute({ response: ProjectListResponse }, async ({ userId }) => {
  const projects = await projectService.listProjects(userId);
  return { projects: projects.map(toResponse) };
});
