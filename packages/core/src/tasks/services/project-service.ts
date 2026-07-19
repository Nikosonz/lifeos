import type { ITaskProjectRepository, IAuditLogRepository, TaskProject } from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";

export class ProjectService {
  constructor(
    private readonly projectRepository: ITaskProjectRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async createProject(
    userId: string,
    data: { name: string; description?: string; color?: string },
  ): Promise<TaskProject> {
    const project = await this.projectRepository.create({ userId, ...data });
    await this.auditLogRepository.record({
      userId,
      action: "tasks.project.created",
      metadata: { projectId: project.id },
    });
    return project;
  }

  listProjects(userId: string): Promise<TaskProject[]> {
    return this.projectRepository.findByUserId(userId);
  }

  async getProject(id: string, userId: string): Promise<TaskProject> {
    return this.getOwned(id, userId);
  }

  async updateProject(
    id: string,
    userId: string,
    data: { name?: string; description?: string; color?: string },
  ): Promise<TaskProject> {
    await this.getOwned(id, userId);
    const updated = await this.projectRepository.update(id, data);
    await this.auditLogRepository.record({
      userId,
      action: "tasks.project.updated",
      metadata: { projectId: id },
    });
    return updated;
  }

  // Unassigns rather than blocks — a task can be projectless, so deleting
  // its project bulk-clears projectId on all its tasks instead of
  // rejecting the delete.
  async deleteProject(id: string, userId: string): Promise<void> {
    await this.getOwned(id, userId);
    await this.projectRepository.softDeleteAndUnassignTasks(id);
    await this.auditLogRepository.record({
      userId,
      action: "tasks.project.deleted",
      metadata: { projectId: id },
    });
  }

  private async getOwned(id: string, userId: string): Promise<TaskProject> {
    const project = await this.projectRepository.findById(id);
    if (!project || project.userId !== userId || project.deletedAt) {
      throw new NotFoundError("Project");
    }
    return project;
  }
}
