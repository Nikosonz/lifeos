import { TaskUpdateInput } from "@lifeos/contracts";
import { taskService } from "@lifeos/core";
import type { TaskWithLabels } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

function toResponse(task: TaskWithLabels) {
  return {
    id: task.id,
    userId: task.userId,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    position: task.position,
    labelIds: task.labels.map((label) => label.id),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    deletedAt: task.deletedAt?.toISOString() ?? null,
    version: task.version,
  };
}

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const task = await taskService.getTask(id, userId);
  return toResponse(task);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = TaskUpdateInput.parse(await req.json());
  const task = await taskService.updateTask(id, userId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.deadline !== undefined
      ? { deadline: input.deadline === null ? null : new Date(input.deadline) }
      : {}),
    ...(input.labelIds !== undefined ? { labelIds: input.labelIds } : {}),
    ...(input.beforeId !== undefined ? { beforeId: input.beforeId } : {}),
    ...(input.afterId !== undefined ? { afterId: input.afterId } : {}),
  });
  return toResponse(task);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  await taskService.deleteTask(id, userId);
  return { ok: true };
});
