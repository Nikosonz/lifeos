import type {
  ITaskRepository,
  ITaskProjectRepository,
  ITaskLabelRepository,
  IAuditLogRepository,
  TaskWithLabels,
  TaskStatus,
  TaskPriority,
} from "@lifeos/db";
import { NotFoundError, ValidationError } from "../../errors/app-error";
import { logger } from "../../logging/logger";
import { appendPosition, relativePosition, needsRenumber, POSITION_GAP } from "../position";

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  deadline?: Date;
  labelIds?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string | null;
  deadline?: Date | null;
  labelIds?: string[];
  beforeId?: string | null;
  afterId?: string | null;
}

export interface ListTasksInput {
  cursor?: Date;
  limit: number;
  status?: TaskStatus;
  projectId?: string;
  labelId?: string;
}

export class TaskService {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly projectRepository: ITaskProjectRepository,
    private readonly labelRepository: ITaskLabelRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async createTask(userId: string, data: CreateTaskInput): Promise<TaskWithLabels> {
    if (data.projectId) await this.assertProjectOwned(data.projectId, userId);
    if (data.labelIds?.length) await this.assertLabelsOwned(data.labelIds, userId);

    const maxPosition = await this.taskRepository.findMaxPosition(userId);
    const task = await this.taskRepository.create({
      userId,
      projectId: data.projectId ?? null,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "TODO",
      priority: data.priority ?? "MEDIUM",
      deadline: data.deadline ?? null,
      position: appendPosition(maxPosition),
      ...(data.labelIds !== undefined ? { labelIds: data.labelIds } : {}),
    });
    await this.auditLogRepository.record({
      userId,
      action: "tasks.task.created",
      metadata: { taskId: task.id },
    });
    return task;
  }

  listTasks(userId: string, opts: ListTasksInput): Promise<TaskWithLabels[]> {
    return this.taskRepository.findByUserId(userId, opts);
  }

  async getTask(id: string, userId: string): Promise<TaskWithLabels> {
    return this.getOwned(id, userId);
  }

  async updateTask(id: string, userId: string, data: UpdateTaskInput): Promise<TaskWithLabels> {
    const existing = await this.getOwned(id, userId);

    if (data.projectId !== undefined && data.projectId !== null) {
      await this.assertProjectOwned(data.projectId, userId);
    }
    if (data.labelIds !== undefined && data.labelIds.length > 0) {
      await this.assertLabelsOwned(data.labelIds, userId);
    }

    let position: number | undefined;
    if (data.beforeId !== undefined || data.afterId !== undefined) {
      position = await this.resolvePosition(
        userId,
        id,
        data.beforeId ?? null,
        data.afterId ?? null,
      );
    }

    // completedAt is the one intended future extension hook: set on
    // transition INTO DONE, cleared on transition OUT of DONE. A later
    // side effect (streak counting, notifications) slots in right here.
    let completedAt: Date | null | undefined;
    if (data.status !== undefined && data.status !== existing.status) {
      if (data.status === "DONE") completedAt = new Date();
      else if (existing.status === "DONE") completedAt = null;
    }

    const updated = await this.taskRepository.update(id, {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
      ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
      ...(data.labelIds !== undefined ? { labelIds: data.labelIds } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
    });
    await this.auditLogRepository.record({
      userId,
      action: "tasks.task.updated",
      metadata: { taskId: id },
    });
    return updated;
  }

  async deleteTask(id: string, userId: string): Promise<void> {
    await this.getOwned(id, userId);
    await this.taskRepository.softDelete(id);
    await this.auditLogRepository.record({
      userId,
      action: "tasks.task.deleted",
      metadata: { taskId: id },
    });
  }

  private async resolvePosition(
    userId: string,
    taskId: string,
    beforeId: string | null,
    afterId: string | null,
  ): Promise<number> {
    if (beforeId === taskId || afterId === taskId) {
      throw new ValidationError("A task cannot be positioned relative to itself");
    }

    const ids = [beforeId, afterId].filter((v): v is string => v !== null);
    const neighbors =
      ids.length > 0 ? await this.taskRepository.findNeighborsForReorder(userId, ids) : [];
    const beforeTask = beforeId !== null ? neighbors.find((t) => t.id === beforeId) : undefined;
    const afterTask = afterId !== null ? neighbors.find((t) => t.id === afterId) : undefined;
    if (beforeId !== null && !beforeTask) throw new NotFoundError("Task");
    if (afterId !== null && !afterTask) throw new NotFoundError("Task");

    const beforePos = beforeTask?.position ?? null;
    const afterPos = afterTask?.position ?? null;

    if (needsRenumber(beforePos, afterPos)) {
      await this.taskRepository.renumberPositions(userId, POSITION_GAP);
      logger.info(
        { event: "tasks.task.positions_renumbered", userId },
        "task positions renumbered",
      );
      const refreshed = await this.taskRepository.findNeighborsForReorder(userId, ids);
      const refreshedBefore =
        beforeId !== null ? refreshed.find((t) => t.id === beforeId) : undefined;
      const refreshedAfter = afterId !== null ? refreshed.find((t) => t.id === afterId) : undefined;
      return relativePosition(refreshedBefore?.position ?? null, refreshedAfter?.position ?? null);
    }

    return relativePosition(beforePos, afterPos);
  }

  private async assertProjectOwned(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project || project.userId !== userId || project.deletedAt) {
      throw new NotFoundError("Project");
    }
  }

  private async assertLabelsOwned(labelIds: string[], userId: string): Promise<void> {
    const labels = await this.labelRepository.findByIds(labelIds);
    const ownedIds = new Set(
      labels.filter((l) => l.userId === userId && !l.deletedAt).map((l) => l.id),
    );
    const missing = labelIds.filter((id) => !ownedIds.has(id));
    if (missing.length > 0) throw new NotFoundError("Label");
  }

  private async getOwned(id: string, userId: string): Promise<TaskWithLabels> {
    const task = await this.taskRepository.findById(id);
    if (!task || task.userId !== userId || task.deletedAt) throw new NotFoundError("Task");
    return task;
  }
}
