import type { PrismaClient, TaskProject } from "../../generated/prisma/index";
import { runVersionedWrite, versionedWhere } from "./optimistic-concurrency";

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
    expectedVersion?: number,
  ): Promise<TaskProject>;
  softDeleteAndUnassignTasks(id: string, expectedVersion?: number): Promise<TaskProject>;
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

  update(
    id: string,
    data: { name?: string; description?: string; color?: string },
    expectedVersion?: number,
  ) {
    return runVersionedWrite(
      () =>
        this.prisma.taskProject.update({
          where: versionedWhere(id, expectedVersion),
          data: { ...data, version: { increment: 1 } },
        }),
      () => this.prisma.taskProject.findUnique({ where: { id }, select: { version: true } }),
    );
  }

  // Soft-delete never triggers Prisma's onDelete, so the bulk unassign has
  // to be explicit. Both writes happen in one transaction so a task can
  // never end up pointing at a deleted project.
  // The version check goes on the project update INSIDE the transaction, so a
  // stale delete rolls back the task-unassignment too. Checking beforehand and
  // then transacting would leave the window this whole mechanism exists to
  // close, and would orphan every task from its project on a conflict.
  async softDeleteAndUnassignTasks(id: string, expectedVersion?: number) {
    return runVersionedWrite(
      async () => {
        const [project] = await this.prisma.$transaction([
          this.prisma.taskProject.update({
            where: versionedWhere(id, expectedVersion),
            data: { deletedAt: new Date(), version: { increment: 1 } },
          }),
          this.prisma.task.updateMany({
            where: { projectId: id },
            data: { projectId: null, version: { increment: 1 } },
          }),
        ]);
        return project;
      },
      () => this.prisma.taskProject.findUnique({ where: { id }, select: { version: true } }),
    );
  }
}
