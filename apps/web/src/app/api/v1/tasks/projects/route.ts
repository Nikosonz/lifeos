import { ProjectCreateInput } from "@lifeos/contracts";
import { projectService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "./to-response";

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = ProjectCreateInput.parse(await req.json());
  const project = await projectService.createProject(userId, {
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
  });
  return toResponse(project);
});

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const projects = await projectService.listProjects(userId);
  return { projects: projects.map(toResponse) };
});
