import {
  TaskResponse,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListResponse,
  ProjectResponse,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectListResponse,
  LabelResponse,
  LabelCreateInput,
  LabelUpdateInput,
  LabelListResponse,
  SubtaskResponse,
  SubtaskCreateInput,
  SubtaskUpdateInput,
  SubtaskListResponse,
  OkResponse,
} from "@lifeos/contracts";
import { apiFetch } from "./api-client";
import type { Versioned } from "./api-client";

export const tasksApi = {
  listTasks: (params: {
    cursor?: string;
    limit?: number;
    status?: string;
    projectId?: string;
    labelId?: string;
  }) => apiFetch("/api/v1/tasks", { query: params, schema: TaskListResponse }),
  createTask: (input: TaskCreateInput) =>
    apiFetch("/api/v1/tasks", { method: "POST", body: input, schema: TaskResponse }),
  updateTask: (id: string, input: Versioned<TaskUpdateInput>) =>
    apiFetch(`/api/v1/tasks/${id}`, { method: "PATCH", body: input, schema: TaskResponse }),
  deleteTask: (id: string, expectedVersion: number) =>
    apiFetch(`/api/v1/tasks/${id}`, {
      method: "DELETE",
      body: { expectedVersion },
      schema: OkResponse,
    }),

  listSubtasks: (taskId: string) =>
    apiFetch(`/api/v1/tasks/${taskId}/subtasks`, { schema: SubtaskListResponse }),
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
    apiFetch(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "DELETE",
      schema: OkResponse,
    }),

  listProjects: () => apiFetch("/api/v1/tasks/projects", { schema: ProjectListResponse }),
  createProject: (input: ProjectCreateInput) =>
    apiFetch("/api/v1/tasks/projects", { method: "POST", body: input, schema: ProjectResponse }),
  updateProject: (id: string, input: Versioned<ProjectUpdateInput>) =>
    apiFetch(`/api/v1/tasks/projects/${id}`, {
      method: "PATCH",
      body: input,
      schema: ProjectResponse,
    }),
  deleteProject: (id: string, expectedVersion: number) =>
    apiFetch(`/api/v1/tasks/projects/${id}`, {
      method: "DELETE",
      body: { expectedVersion },
      schema: OkResponse,
    }),

  listLabels: () => apiFetch("/api/v1/tasks/labels", { schema: LabelListResponse }),
  createLabel: (input: LabelCreateInput) =>
    apiFetch("/api/v1/tasks/labels", { method: "POST", body: input, schema: LabelResponse }),
  updateLabel: (id: string, input: Versioned<LabelUpdateInput>) =>
    apiFetch(`/api/v1/tasks/labels/${id}`, {
      method: "PATCH",
      body: input,
      schema: LabelResponse,
    }),
  deleteLabel: (id: string, expectedVersion: number) =>
    apiFetch(`/api/v1/tasks/labels/${id}`, {
      method: "DELETE",
      body: { expectedVersion },
      schema: OkResponse,
    }),
};
