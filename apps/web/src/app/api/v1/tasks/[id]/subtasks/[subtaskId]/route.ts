import { SubtaskUpdateInput } from "@lifeos/contracts";
import { subtaskService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string; subtaskId: string }> };

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id, subtaskId } = await uuidParams(ctx.params);
  const subtask = await subtaskService.getSubtask(id, subtaskId, userId);
  return toResponse(subtask);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id, subtaskId } = await uuidParams(ctx.params);
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
  const { id, subtaskId } = await uuidParams(ctx.params);
  await subtaskService.deleteSubtask(id, subtaskId, userId);
  return { ok: true };
});
