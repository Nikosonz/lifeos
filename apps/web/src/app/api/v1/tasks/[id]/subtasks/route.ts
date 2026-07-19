import { SubtaskCreateInput } from "@lifeos/contracts";
import { subtaskService } from "@lifeos/core";
import type { Subtask } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

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

export const POST = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = SubtaskCreateInput.parse(await req.json());
  const subtask = await subtaskService.createSubtask(id, userId, input);
  return toResponse(subtask);
});

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const subtasks = await subtaskService.listSubtasks(id, userId);
  return { subtasks: subtasks.map(toResponse) };
});
