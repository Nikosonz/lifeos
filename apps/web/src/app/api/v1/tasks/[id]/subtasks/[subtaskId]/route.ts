import { SubtaskUpdateInput } from "@lifeos/contracts";
import { subtaskService } from "@lifeos/core";
import type { Subtask } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string; subtaskId: string }> };

function toResponse(subtask: Subtask) {
  return {
    id: subtask.id,
    taskId: subtask.taskId,
    userId: subtask.userId,
    title: subtask.title,
    completed: subtask.completed,
    position: subtask.position,
    createdAt: subtask.createdAt.toISOString(),
    updatedAt: subtask.updatedAt.toISOString(),
    deletedAt: subtask.deletedAt?.toISOString() ?? null,
    version: subtask.version,
  };
}

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id, subtaskId } = await ctx.params;
  const subtask = await subtaskService.getSubtask(id, subtaskId, userId);
  return toResponse(subtask);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id, subtaskId } = await ctx.params;
  const input = SubtaskUpdateInput.parse(await req.json());
  const subtask = await subtaskService.updateSubtask(id, subtaskId, userId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.completed !== undefined ? { completed: input.completed } : {}),
    ...(input.beforeId !== undefined ? { beforeId: input.beforeId } : {}),
    ...(input.afterId !== undefined ? { afterId: input.afterId } : {}),
  });
  return toResponse(subtask);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id, subtaskId } = await ctx.params;
  await subtaskService.deleteSubtask(id, subtaskId, userId);
  return { ok: true };
});
