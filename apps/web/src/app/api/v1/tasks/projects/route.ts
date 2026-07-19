import { ProjectCreateInput } from "@lifeos/contracts";
import { projectService } from "@lifeos/core";
import type { TaskProject } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

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
