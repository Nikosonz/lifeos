import type { ITaskProjectRepository, IAuditLogRepository, TaskProject } from "@lifeos/db";
import { OwnedResourceCrud } from "../../shared/owned-resource-crud";

export class ProjectService {
  private readonly crud: OwnedResourceCrud<
    TaskProject,
    { userId: string; name: string; description?: string; color?: string },
    { name?: string; description?: string; color?: string }
  >;

  constructor(
    private readonly projectRepository: ITaskProjectRepository,
    auditLogRepository: IAuditLogRepository,
  ) {
    this.crud = new OwnedResourceCrud(projectRepository, auditLogRepository, {
      entityName: "Project",
      actionPrefix: "tasks.project",
    });
  }

  createProject(
    userId: string,
    data: { name: string; description?: string; color?: string },
  ): Promise<TaskProject> {
    return this.crud.create({ userId, ...data });
  }

  listProjects(userId: string): Promise<TaskProject[]> {
    return this.projectRepository.findByUserId(userId);
  }

  getProject(id: string, userId: string): Promise<TaskProject> {
    return this.crud.getOwned(id, userId);
  }

  updateProject(
    id: string,
    userId: string,
    data: { name?: string; description?: string; color?: string },
    expectedVersion?: number,
  ): Promise<TaskProject> {
    return this.crud.update(id, userId, data, expectedVersion);
  }

  // Bypasses crud.delete — a project's delete has a real side effect beyond
  // soft-deleting the row itself (bulk-unassigning its tasks, since a task
  // can be projectless), so ITaskProjectRepository has no plain softDelete
  // at all. Still reuses getOwned/audit for the rest of the lifecycle.
  async deleteProject(id: string, userId: string, expectedVersion?: number): Promise<void> {
    await this.crud.getOwned(id, userId);
    await this.crud.versionedWrite("delete", userId, expectedVersion, () =>
      this.projectRepository.softDeleteAndUnassignTasks(id, expectedVersion),
    );
    await this.crud.audit(userId, "deleted", id);
  }
}
