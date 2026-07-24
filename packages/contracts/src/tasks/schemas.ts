import { z } from "zod";
import { SyncFields } from "../common/sync";
import { CursorQuery, paginatedResponse } from "../common/pagination";

export const TaskStatus = z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskPriority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

// A reorder request naming the same task on both sides is always
// nonsensical — checked here since it's a pure cross-field comparison;
// self-reference against the URL's own :id can only be checked in the
// service, where the target row's id is known.
function rejectSameNeighbor<
  T extends { beforeId?: string | null | undefined; afterId?: string | null | undefined },
>(data: T, ctx: z.RefinementCtx) {
  if (data.beforeId != null && data.afterId != null && data.beforeId === data.afterId) {
    ctx.addIssue({
      code: "custom",
      message: "beforeId and afterId must differ",
      path: ["afterId"],
    });
  }
}

// --- Projects ---

export const ProjectCreateInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  color: z.string().max(20).optional(),
});
export type ProjectCreateInput = z.infer<typeof ProjectCreateInput>;

export const ProjectUpdateInput = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().max(20).optional(),
});
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateInput>;

export const ProjectResponse = SyncFields.extend({
  userId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
});
export type ProjectResponse = z.infer<typeof ProjectResponse>;

export const ProjectListResponse = z.object({ projects: z.array(ProjectResponse) });
export type ProjectListResponse = z.infer<typeof ProjectListResponse>;

// --- Labels ---

export const LabelCreateInput = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(20).optional(),
});
export type LabelCreateInput = z.infer<typeof LabelCreateInput>;

export const LabelUpdateInput = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(20).optional(),
});
export type LabelUpdateInput = z.infer<typeof LabelUpdateInput>;

export const LabelResponse = SyncFields.extend({
  userId: z.uuid(),
  name: z.string(),
  color: z.string().nullable(),
});
export type LabelResponse = z.infer<typeof LabelResponse>;

export const LabelListResponse = z.object({ labels: z.array(LabelResponse) });
export type LabelListResponse = z.infer<typeof LabelListResponse>;

// --- Tasks ---

export const TaskCreateInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  projectId: z.uuid().optional(),
  deadline: z.string().datetime().optional(),
  labelIds: z.array(z.uuid()).optional(),
});
export type TaskCreateInput = z.infer<typeof TaskCreateInput>;

// projectId/deadline/description are three-state (absent = no change,
// null = clear, value = set) — unlike Finance, unassigning a project or
// clearing a deadline is an ordinary action here, not an edge case.
export const TaskUpdateInput = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: TaskStatus.optional(),
    priority: TaskPriority.optional(),
    projectId: z.uuid().nullable().optional(),
    deadline: z.string().datetime().nullable().optional(),
    labelIds: z.array(z.uuid()).optional(),
    beforeId: z.uuid().nullable().optional(),
    afterId: z.uuid().nullable().optional(),
  })
  .superRefine(rejectSameNeighbor);
export type TaskUpdateInput = z.infer<typeof TaskUpdateInput>;

export const TaskResponse = SyncFields.extend({
  userId: z.uuid(),
  projectId: z.uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatus,
  priority: TaskPriority,
  deadline: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  position: z.number(),
  labelIds: z.array(z.uuid()),
});
export type TaskResponse = z.infer<typeof TaskResponse>;

export const TaskListQuery = CursorQuery.extend({
  status: TaskStatus.optional(),
  projectId: z.uuid().optional(),
  labelId: z.uuid().optional(),
});
export type TaskListQuery = z.infer<typeof TaskListQuery>;

export const TaskListResponse = paginatedResponse(TaskResponse);
export type TaskListResponse = z.infer<typeof TaskListResponse>;

// --- Subtasks ---

export const SubtaskCreateInput = z.object({
  title: z.string().min(1).max(200),
});
export type SubtaskCreateInput = z.infer<typeof SubtaskCreateInput>;

export const SubtaskUpdateInput = z
  .object({
    title: z.string().min(1).max(200).optional(),
    completed: z.boolean().optional(),
    beforeId: z.uuid().nullable().optional(),
    afterId: z.uuid().nullable().optional(),
  })
  .superRefine(rejectSameNeighbor);
export type SubtaskUpdateInput = z.infer<typeof SubtaskUpdateInput>;

export const SubtaskResponse = SyncFields.extend({
  taskId: z.uuid(),
  userId: z.uuid(),
  title: z.string(),
  completed: z.boolean(),
  position: z.number(),
});
export type SubtaskResponse = z.infer<typeof SubtaskResponse>;

export const SubtaskListResponse = z.object({ subtasks: z.array(SubtaskResponse) });
export type SubtaskListResponse = z.infer<typeof SubtaskListResponse>;
