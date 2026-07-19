import type { PrismaClient, Subtask } from "../../generated/prisma/index";

interface CreateData {
  taskId: string;
  userId: string;
  title: string;
  position: number;
}

interface UpdateData {
  title?: string;
  completed?: boolean;
  position?: number;
}

export interface ISubtaskRepository {
  create(data: CreateData): Promise<Subtask>;
  findById(id: string): Promise<Subtask | null>;
  findByTaskId(taskId: string): Promise<Subtask[]>;
  update(id: string, data: UpdateData): Promise<Subtask>;
  softDelete(id: string): Promise<Subtask>;
  findMaxPosition(taskId: string): Promise<number | null>;
  findNeighborsForReorder(taskId: string, ids: string[]): Promise<Subtask[]>;
  renumberPositions(taskId: string, gap: number): Promise<void>;
}

export class SubtaskRepository implements ISubtaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreateData) {
    return this.prisma.subtask.create({ data });
  }

  findById(id: string) {
    return this.prisma.subtask.findUnique({ where: { id } });
  }

  findByTaskId(taskId: string) {
    return this.prisma.subtask.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { position: "asc" },
    });
  }

  update(id: string, data: UpdateData) {
    return this.prisma.subtask.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  softDelete(id: string) {
    return this.prisma.subtask.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  async findMaxPosition(taskId: string) {
    const top = await this.prisma.subtask.findFirst({
      where: { taskId, deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return top?.position ?? null;
  }

  // Scoped by taskId — a beforeId/afterId belonging to a different task
  // simply won't come back here, which is what enforces "same task"
  // ownership for reorder requests without a separate check.
  findNeighborsForReorder(taskId: string, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.subtask.findMany({ where: { taskId, deletedAt: null, id: { in: ids } } });
  }

  async renumberPositions(taskId: string, gap: number) {
    const subtasks = await this.prisma.subtask.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    await this.prisma.$transaction(
      subtasks.map((subtask, index) =>
        this.prisma.subtask.update({
          where: { id: subtask.id },
          data: { position: (index + 1) * gap },
        }),
      ),
    );
  }
}
