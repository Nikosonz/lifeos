import { Prisma } from "../../generated/prisma/index";
import type { PrismaClient, TaskLabel } from "../../generated/prisma/index";
import { runVersionedWrite, versionedWhere } from "./optimistic-concurrency";

// Thrown when a create/update hits the (userId, name) unique constraint —
// translated from Prisma's P2002 so packages/core never touches a
// Prisma-specific error code. Mirrors IdempotencyKeyRaceError's pattern.
export class LabelNameConflictError extends Error {
  constructor() {
    super("A label with this name already exists");
    this.name = "LabelNameConflictError";
  }
}

export interface ITaskLabelRepository {
  create(data: { userId: string; name: string; color?: string }): Promise<TaskLabel>;
  findById(id: string): Promise<TaskLabel | null>;
  findByUserId(userId: string): Promise<TaskLabel[]>;
  findByIds(ids: string[]): Promise<TaskLabel[]>;
  update(
    id: string,
    data: { name?: string; color?: string },
    expectedVersion?: number,
  ): Promise<TaskLabel>;
  softDelete(id: string, expectedVersion?: number): Promise<TaskLabel>;
}

export class TaskLabelRepository implements ITaskLabelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { userId: string; name: string; color?: string }) {
    try {
      return await this.prisma.taskLabel.create({ data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new LabelNameConflictError();
      }
      throw err;
    }
  }

  findById(id: string) {
    return this.prisma.taskLabel.findUnique({ where: { id } });
  }

  findByUserId(userId: string) {
    return this.prisma.taskLabel.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  findByIds(ids: string[]) {
    return this.prisma.taskLabel.findMany({ where: { id: { in: ids } } });
  }

  // Two Prisma error codes are in play here and they must not be conflated:
  // P2002 is a duplicate label name (the user's own input is wrong), P2025 is
  // a version mismatch or a vanished row (someone else got there first). The
  // P2002 check runs first and returns before runVersionedWrite's handler ever
  // sees it.
  async update(id: string, data: { name?: string; color?: string }, expectedVersion?: number) {
    return runVersionedWrite(
      async () => {
        try {
          return await this.prisma.taskLabel.update({
            where: versionedWhere(id, expectedVersion),
            data: { ...data, version: { increment: 1 } },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new LabelNameConflictError();
          }
          throw err;
        }
      },
      () => this.prisma.taskLabel.findUnique({ where: { id }, select: { version: true } }),
    );
  }

  softDelete(id: string, expectedVersion?: number) {
    return runVersionedWrite(
      () =>
        this.prisma.taskLabel.update({
          where: versionedWhere(id, expectedVersion),
          data: { deletedAt: new Date(), version: { increment: 1 } },
        }),
      () => this.prisma.taskLabel.findUnique({ where: { id }, select: { version: true } }),
    );
  }
}
