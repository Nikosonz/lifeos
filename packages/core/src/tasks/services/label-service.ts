import { LabelNameConflictError } from "@lifeos/db";
import type { ITaskLabelRepository, IAuditLogRepository, TaskLabel } from "@lifeos/db";
import { NotFoundError, ConflictError } from "../../errors/app-error";

export class LabelService {
  constructor(
    private readonly labelRepository: ITaskLabelRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async createLabel(userId: string, data: { name: string; color?: string }): Promise<TaskLabel> {
    const label = await this.create(userId, data);
    await this.auditLogRepository.record({
      userId,
      action: "tasks.label.created",
      metadata: { labelId: label.id },
    });
    return label;
  }

  listLabels(userId: string): Promise<TaskLabel[]> {
    return this.labelRepository.findByUserId(userId);
  }

  async getLabel(id: string, userId: string): Promise<TaskLabel> {
    return this.getOwned(id, userId);
  }

  async updateLabel(
    id: string,
    userId: string,
    data: { name?: string; color?: string },
  ): Promise<TaskLabel> {
    await this.getOwned(id, userId);
    const updated = await this.update(id, data);
    await this.auditLogRepository.record({
      userId,
      action: "tasks.label.updated",
      metadata: { labelId: id },
    });
    return updated;
  }

  async deleteLabel(id: string, userId: string): Promise<void> {
    await this.getOwned(id, userId);
    await this.labelRepository.softDelete(id);
    await this.auditLogRepository.record({
      userId,
      action: "tasks.label.deleted",
      metadata: { labelId: id },
    });
  }

  private async create(userId: string, data: { name: string; color?: string }) {
    try {
      return await this.labelRepository.create({ userId, ...data });
    } catch (err) {
      if (err instanceof LabelNameConflictError) {
        throw new ConflictError(`A label named "${data.name}" already exists`);
      }
      throw err;
    }
  }

  private async update(id: string, data: { name?: string; color?: string }) {
    try {
      return await this.labelRepository.update(id, data);
    } catch (err) {
      if (err instanceof LabelNameConflictError && data.name) {
        throw new ConflictError(`A label named "${data.name}" already exists`);
      }
      throw err;
    }
  }

  private async getOwned(id: string, userId: string): Promise<TaskLabel> {
    const label = await this.labelRepository.findById(id);
    if (!label || label.userId !== userId || label.deletedAt) throw new NotFoundError("Label");
    return label;
  }
}
