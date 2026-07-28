import { TaskUpdateInput } from "@lifeos/contracts";
import { taskService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const task = await taskService.getTask(id, userId);
  return toResponse(task);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
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
  const { id } = await uuidParams(ctx.params);
  await taskService.deleteTask(id, userId);
  return { ok: true };
});
