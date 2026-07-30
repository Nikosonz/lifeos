import { SubtaskCreateInput } from "@lifeos/contracts";
import { subtaskService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "./to-response";

export const POST = defineRoute(
  { params: ["id"], body: SubtaskCreateInput },
  async ({ userId, params, body: input }) => {
    const { id } = params;
    const subtask = await subtaskService.createSubtask(id, userId, input);
    return toResponse(subtask);
  },
);

export const GET = defineRoute({ params: ["id"] }, async ({ userId, params }) => {
  const { id } = params;
  const subtasks = await subtaskService.listSubtasks(id, userId);
  return { subtasks: subtasks.map(toResponse) };
});
