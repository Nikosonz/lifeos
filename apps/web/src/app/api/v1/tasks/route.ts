import { TaskCreateInput, TaskListQuery } from "@lifeos/contracts";
import { taskService } from "@lifeos/core";
import type { TaskWithLabels } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

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

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = TaskCreateInput.parse(await req.json());
  const task = await taskService.createTask(userId, {
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.deadline !== undefined ? { deadline: new Date(input.deadline) } : {}),
    ...(input.labelIds !== undefined ? { labelIds: input.labelIds } : {}),
  });
  return toResponse(task);
});

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const query = TaskListQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const tasks = await taskService.listTasks(userId, {
    ...(query.cursor !== undefined ? { cursor: new Date(query.cursor) } : {}),
    limit: query.limit,
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.projectId !== undefined ? { projectId: query.projectId } : {}),
    ...(query.labelId !== undefined ? { labelId: query.labelId } : {}),
  });
  const last = tasks[tasks.length - 1];
  const nextCursor = tasks.length === query.limit && last ? last.updatedAt.toISOString() : null;
  return { items: tasks.map(toResponse), nextCursor };
});
