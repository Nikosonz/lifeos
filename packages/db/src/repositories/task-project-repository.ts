import type { PrismaClient, TaskProject } from "../../generated/prisma/index";

export interface ITaskProjectRepository {
  create(data: {
    userId: string;
    name: string;
    description?: string;
    color?: string;
  }): Promise<TaskProject>;
  findById(id: string): Promise<TaskProject | null>;
  findByUserId(userId: string): Promise<TaskProject[]>;
  update(
    id: string,
    data: { name?: string; description?: string; color?: string },
  ): Promise<TaskProject>;
  softDeleteAndUnassignTasks(id: string): Promise<TaskProject>;
}

export class TaskProjectRepository implements ITaskProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: { userId: string; name: string; description?: string; color?: string }) {
    return this.prisma.taskProject.create({ data });
  }

  findById(id: string) {
    return this.prisma.taskProject.findUnique({ where: { id } });
  }

  findByUserId(userId: string) {
    return this.prisma.taskProject.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  update(id: string, data: { name?: string; description?: string; color?: string }) {
    return this.prisma.taskProject.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  // Soft-delete never triggers Prisma's onDelete, so the bulk unassign has
  // to be explicit. Both writes happen in one transaction so a task can
  // never end up pointing at a deleted project.
  async softDeleteAndUnassignTasks(id: string) {
    const [project] = await this.prisma.$transaction([
      this.prisma.taskProject.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      }),
      this.prisma.task.updateMany({
        where: { projectId: id },
        data: { projectId: null, version: { increment: 1 } },
      }),
    ]);
    return project;
  }
}
