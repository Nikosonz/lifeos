import type { ISubtaskRepository, ITaskRepository, IAuditLogRepository, Subtask } from "@lifeos/db";
import { NotFoundError, ValidationError } from "../../errors/app-error";
import { logger } from "../../logging/logger";
import { appendPosition, relativePosition, needsRenumber, POSITION_GAP } from "../position";

export interface UpdateSubtaskInput {
  title?: string;
  completed?: boolean;
  beforeId?: string | null;
  afterId?: string | null;
}

// Depends directly on ITaskRepository (not ProjectService/TaskService) for
// parent-ownership checks — same shape TransactionService already uses for
// wallet/category ownership.
export class SubtaskService {
  constructor(
    private readonly subtaskRepository: ISubtaskRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async createSubtask(taskId: string, userId: string, data: { title: string }): Promise<Subtask> {
    await this.getOwnedTask(taskId, userId);
    const maxPosition = await this.subtaskRepository.findMaxPosition(taskId);
    const subtask = await this.subtaskRepository.create({
      taskId,
      userId,
      title: data.title,
      position: appendPosition(maxPosition),
    });
    await this.auditLogRepository.record({
      userId,
      action: "tasks.subtask.created",
      metadata: { subtaskId: subtask.id, taskId },
    });
    return subtask;
  }

  async listSubtasks(taskId: string, userId: string): Promise<Subtask[]> {
    await this.getOwnedTask(taskId, userId);
    return this.subtaskRepository.findByTaskId(taskId);
  }

  async getSubtask(taskId: string, subtaskId: string, userId: string): Promise<Subtask> {
    await this.getOwnedTask(taskId, userId);
    return this.getOwnedSubtask(subtaskId, taskId);
  }

  async updateSubtask(
    taskId: string,
    subtaskId: string,
    userId: string,
    data: UpdateSubtaskInput,
  ): Promise<Subtask> {
    await this.getOwnedTask(taskId, userId);
    await this.getOwnedSubtask(subtaskId, taskId);

    let position: number | undefined;
    if (data.beforeId !== undefined || data.afterId !== undefined) {
      position = await this.resolvePosition(
        taskId,
        subtaskId,
        data.beforeId ?? null,
        data.afterId ?? null,
      );
    }

    const updated = await this.subtaskRepository.update(subtaskId, {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.completed !== undefined ? { completed: data.completed } : {}),
      ...(position !== undefined ? { position } : {}),
    });
    await this.auditLogRepository.record({
      userId,
      action: "tasks.subtask.updated",
      metadata: { subtaskId, taskId },
    });
    return updated;
  }

  async deleteSubtask(taskId: string, subtaskId: string, userId: string): Promise<void> {
    await this.getOwnedTask(taskId, userId);
    await this.getOwnedSubtask(subtaskId, taskId);
    await this.subtaskRepository.softDelete(subtaskId);
    await this.auditLogRepository.record({
      userId,
      action: "tasks.subtask.deleted",
      metadata: { subtaskId, taskId },
    });
  }

  private async resolvePosition(
    taskId: string,
    subtaskId: string,
    beforeId: string | null,
    afterId: string | null,
  ): Promise<number> {
    if (beforeId === subtaskId || afterId === subtaskId) {
      throw new ValidationError("A subtask cannot be positioned relative to itself");
    }

    const ids = [beforeId, afterId].filter((v): v is string => v !== null);
    const neighbors =
      ids.length > 0 ? await this.subtaskRepository.findNeighborsForReorder(taskId, ids) : [];
    const beforeSub = beforeId !== null ? neighbors.find((s) => s.id === beforeId) : undefined;
    const afterSub = afterId !== null ? neighbors.find((s) => s.id === afterId) : undefined;
    // findNeighborsForReorder is scoped by taskId, so a beforeId/afterId
    // belonging to a DIFFERENT task simply won't be found here — this is
    // what enforces "same task" ownership, not a separate explicit check.
    if (beforeId !== null && !beforeSub) throw new NotFoundError("Subtask");
    if (afterId !== null && !afterSub) throw new NotFoundError("Subtask");

    const beforePos = beforeSub?.position ?? null;
    const afterPos = afterSub?.position ?? null;

    if (needsRenumber(beforePos, afterPos)) {
      await this.subtaskRepository.renumberPositions(taskId, POSITION_GAP);
      logger.info(
        { event: "tasks.subtask.positions_renumbered", taskId },
        "subtask positions renumbered",
      );
      const refreshed = await this.subtaskRepository.findNeighborsForReorder(taskId, ids);
      const refreshedBefore =
        beforeId !== null ? refreshed.find((s) => s.id === beforeId) : undefined;
      const refreshedAfter = afterId !== null ? refreshed.find((s) => s.id === afterId) : undefined;
      return relativePosition(refreshedBefore?.position ?? null, refreshedAfter?.position ?? null);
    }

    return relativePosition(beforePos, afterPos);
  }

  private async getOwnedTask(taskId: string, userId: string) {
    const task = await this.taskRepository.findById(taskId);
    if (!task || task.userId !== userId || task.deletedAt) throw new NotFoundError("Task");
    return task;
  }

  private async getOwnedSubtask(subtaskId: string, taskId: string): Promise<Subtask> {
    const subtask = await this.subtaskRepository.findById(subtaskId);
    if (!subtask || subtask.taskId !== taskId || subtask.deletedAt) {
      throw new NotFoundError("Subtask");
    }
    return subtask;
  }
}
