import { SubtaskUpdateInput, OkResponse, SubtaskResponse } from "@lifeos/contracts";
import { subtaskService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const GET = defineRoute(
  { params: ["id", "subtaskId"], response: SubtaskResponse },
  async ({ userId, params }) => {
    const { id, subtaskId } = params;
    const subtask = await subtaskService.getSubtask(id, subtaskId, userId);
    return toResponse(subtask);
  },
);

export const PATCH = defineRoute(
  { params: ["id", "subtaskId"], body: SubtaskUpdateInput, response: SubtaskResponse },
  async ({ userId, params, body: input }) => {
    const { id, subtaskId } = params;
    const subtask = await subtaskService.updateSubtask(id, subtaskId, userId, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.completed !== undefined ? { completed: input.completed } : {}),
      ...(input.beforeId !== undefined ? { beforeId: input.beforeId } : {}),
      ...(input.afterId !== undefined ? { afterId: input.afterId } : {}),
    });
    return toResponse(subtask);
  },
);

export const DELETE = defineRoute(
  { params: ["id", "subtaskId"], response: OkResponse },
  async ({ userId, params }) => {
    const { id, subtaskId } = params;
    await subtaskService.deleteSubtask(id, subtaskId, userId);
    return { ok: true };
  },
);
