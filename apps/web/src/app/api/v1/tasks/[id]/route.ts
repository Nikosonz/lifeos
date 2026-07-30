import { TaskUpdateInput, VersionedDeleteInput } from "@lifeos/contracts";
import { taskService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const GET = defineRoute({ params: ["id"] }, async ({ userId, params }) => {
  const { id } = params;
  const task = await taskService.getTask(id, userId);
  return toResponse(task);
});

export const PATCH = defineRoute(
  { params: ["id"], body: TaskUpdateInput },
  async ({ userId, params, body: input }) => {
    const { id } = params;
    const task = await taskService.updateTask(
      id,
      userId,
      {
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
      },
      input.expectedVersion,
    );
    return toResponse(task);
  },
);

export const DELETE = defineRoute(
  { params: ["id"], body: VersionedDeleteInput },
  async ({ userId, params, body: { expectedVersion } }) => {
    const { id } = params;
    await taskService.deleteTask(id, userId, expectedVersion);
    return { ok: true };
  },
);
