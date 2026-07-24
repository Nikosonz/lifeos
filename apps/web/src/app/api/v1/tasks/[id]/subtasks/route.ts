import { SubtaskCreateInput } from "@lifeos/contracts";
import { subtaskService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "./to-response";

type Ctx = { params: Promise<{ id: string }> };

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
