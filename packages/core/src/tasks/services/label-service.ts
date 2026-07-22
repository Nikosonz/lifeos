import { LabelNameConflictError } from "@lifeos/db";
import type { ITaskLabelRepository, IAuditLogRepository, TaskLabel } from "@lifeos/db";
import { ConflictError } from "../../errors/app-error";
import { OwnedResourceCrud } from "../../shared/owned-resource-crud";

export class LabelService {
  private readonly crud: OwnedResourceCrud<
    TaskLabel,
    { userId: string; name: string; color?: string },
    { name?: string; color?: string }
  >;

  constructor(
    private readonly labelRepository: ITaskLabelRepository,
    auditLogRepository: IAuditLogRepository,
  ) {
    this.crud = new OwnedResourceCrud(labelRepository, auditLogRepository, {
      entityName: "Label",
      actionPrefix: "tasks.label",
    });
  }

  // Bypasses crud.create — translating LabelNameConflictError to
  // ConflictError is Label's own concern, the one place that knows about
  // that repository-level error. Still reuses crud.audit for the log entry.
  async createLabel(userId: string, data: { name: string; color?: string }): Promise<TaskLabel> {
    try {
      const label = await this.labelRepository.create({ userId, ...data });
      await this.crud.audit(userId, "created", label.id);
      return label;
    } catch (err) {
      if (err instanceof LabelNameConflictError) {
        throw new ConflictError(`A label named "${data.name}" already exists`);
      }
      throw err;
    }
  }

  listLabels(userId: string): Promise<TaskLabel[]> {
    return this.labelRepository.findByUserId(userId);
  }

  getLabel(id: string, userId: string): Promise<TaskLabel> {
    return this.crud.getOwned(id, userId);
  }

  // Bypasses crud.update for the same reason createLabel bypasses crud.create.
  async updateLabel(
    id: string,
    userId: string,
    data: { name?: string; color?: string },
  ): Promise<TaskLabel> {
    await this.crud.getOwned(id, userId);
    try {
      const updated = await this.labelRepository.update(id, data);
      await this.crud.audit(userId, "updated", id);
      return updated;
    } catch (err) {
      if (err instanceof LabelNameConflictError && data.name) {
        throw new ConflictError(`A label named "${data.name}" already exists`);
      }
      throw err;
    }
  }

  deleteLabel(id: string, userId: string): Promise<void> {
    return this.crud.delete(id, userId);
  }
}
