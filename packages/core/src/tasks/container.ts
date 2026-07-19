import {
  prisma,
  TaskProjectRepository,
  TaskRepository,
  SubtaskRepository,
  TaskLabelRepository,
  AuditLogRepository,
} from "@lifeos/db";
import { ProjectService } from "./services/project-service";
import { LabelService } from "./services/label-service";
import { TaskService } from "./services/task-service";
import { SubtaskService } from "./services/subtask-service";

// Composition root for the tasks module — the only file in this module
// that imports @lifeos/db. apps/web imports the exported singletons below
// and never touches @lifeos/db directly (enforced by ESLint boundaries).
const projectRepository = new TaskProjectRepository(prisma);
const taskRepository = new TaskRepository(prisma);
const subtaskRepository = new SubtaskRepository(prisma);
const labelRepository = new TaskLabelRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);

export const projectService = new ProjectService(projectRepository, auditLogRepository);

export const labelService = new LabelService(labelRepository, auditLogRepository);

export const taskService = new TaskService(
  taskRepository,
  projectRepository,
  labelRepository,
  auditLogRepository,
);

export const subtaskService = new SubtaskService(
  subtaskRepository,
  taskRepository,
  auditLogRepository,
);
