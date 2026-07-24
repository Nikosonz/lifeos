import { TaskCreateInput, TaskListQuery } from "@lifeos/contracts";
import { taskService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "./to-response";

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
