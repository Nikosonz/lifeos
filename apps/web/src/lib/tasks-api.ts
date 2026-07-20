import { z } from "zod";
import {
  TaskResponse,
  TaskCreateInput,
  TaskUpdateInput,
  ProjectResponse,
  ProjectCreateInput,
  ProjectUpdateInput,
  LabelResponse,
  LabelCreateInput,
  LabelUpdateInput,
  SubtaskResponse,
  SubtaskCreateInput,
  SubtaskUpdateInput,
} from "@lifeos/contracts";
import { apiFetch } from "./api-client";

// Response wrapper shapes confirmed by reading the actual route handlers
// directly (apps/web/src/app/api/v1/tasks/**/route.ts) — projects/labels/
// subtasks each wrap their array in a named key, only the top-level task
// list uses the generic cursor-pagination envelope (same split
// finance-api.ts already documents for its own module).
const TasksListResponse = z.object({
  items: z.array(TaskResponse),
  nextCursor: z.string().nullable(),
});
const ProjectsListResponse = z.object({ projects: z.array(ProjectResponse) });
const LabelsListResponse = z.object({ labels: z.array(LabelResponse) });
const SubtasksListResponse = z.object({ subtasks: z.array(SubtaskResponse) });

export const tasksApi = {
  listTasks: (params: {
    cursor?: string;
    limit?: number;
    status?: string;
    projectId?: string;
    labelId?: string;
  }) => apiFetch("/api/v1/tasks", { query: params, schema: TasksListResponse }),
  createTask: (input: TaskCreateInput) =>
    apiFetch("/api/v1/tasks", { method: "POST", body: input, schema: TaskResponse }),
  updateTask: (id: string, input: TaskUpdateInput) =>
    apiFetch(`/api/v1/tasks/${id}`, { method: "PATCH", body: input, schema: TaskResponse }),
  deleteTask: (id: string) => apiFetch(`/api/v1/tasks/${id}`, { method: "DELETE" }),

  listSubtasks: (taskId: string) =>
    apiFetch(`/api/v1/tasks/${taskId}/subtasks`, { schema: SubtasksListResponse }),
  createSubtask: (taskId: string, input: SubtaskCreateInput) =>
    apiFetch(`/api/v1/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: input,
      schema: SubtaskResponse,
    }),
  updateSubtask: (taskId: string, subtaskId: string, input: SubtaskUpdateInput) =>
    apiFetch(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PATCH",
      body: input,
      schema: SubtaskResponse,
    }),
  deleteSubtask: (taskId: string, subtaskId: string) =>
    apiFetch(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" }),

  listProjects: () => apiFetch("/api/v1/tasks/projects", { schema: ProjectsListResponse }),
  createProject: (input: ProjectCreateInput) =>
    apiFetch("/api/v1/tasks/projects", { method: "POST", body: input, schema: ProjectResponse }),
  updateProject: (id: string, input: ProjectUpdateInput) =>
    apiFetch(`/api/v1/tasks/projects/${id}`, {
      method: "PATCH",
      body: input,
      schema: ProjectResponse,
    }),
  deleteProject: (id: string) => apiFetch(`/api/v1/tasks/projects/${id}`, { method: "DELETE" }),

  listLabels: () => apiFetch("/api/v1/tasks/labels", { schema: LabelsListResponse }),
  createLabel: (input: LabelCreateInput) =>
    apiFetch("/api/v1/tasks/labels", { method: "POST", body: input, schema: LabelResponse }),
  updateLabel: (id: string, input: LabelUpdateInput) =>
    apiFetch(`/api/v1/tasks/labels/${id}`, {
      method: "PATCH",
      body: input,
      schema: LabelResponse,
    }),
  deleteLabel: (id: string) => apiFetch(`/api/v1/tasks/labels/${id}`, { method: "DELETE" }),
};
