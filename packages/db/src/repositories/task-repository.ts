import type {
  PrismaClient,
  Task,
  TaskLabel,
  TaskStatus,
  TaskPriority,
} from "../../generated/prisma/index";

// Soft-delete never touches many-to-many join rows, so every read that
// includes labels filters deletedAt on the label side explicitly.
const LABEL_INCLUDE = { labels: { where: { deletedAt: null } } } as const;

export type TaskWithLabels = Task & { labels: TaskLabel[] };

interface CreateData {
  userId: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: Date | null;
  position: number;
  labelIds?: string[];
}

interface UpdateData {
  projectId?: string | null;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: Date | null;
  completedAt?: Date | null;
  position?: number;
  labelIds?: string[];
}

export interface ITaskRepository {
  create(data: CreateData): Promise<TaskWithLabels>;
  findById(id: string): Promise<TaskWithLabels | null>;
  findByUserId(
    userId: string,
    opts: {
      cursor?: Date;
      limit: number;
      status?: TaskStatus;
      projectId?: string;
      labelId?: string;
    },
  ): Promise<TaskWithLabels[]>;
  update(id: string, data: UpdateData): Promise<TaskWithLabels>;
  softDelete(id: string): Promise<Task>;
  findMaxPosition(userId: string): Promise<number | null>;
  findNeighborsForReorder(userId: string, ids: string[]): Promise<Task[]>;
  renumberPositions(userId: string, gap: number): Promise<void>;
}

export class TaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreateData) {
    const { labelIds, ...rest } = data;
    return this.prisma.task.create({
      data: {
        ...rest,
        ...(labelIds ? { labels: { connect: labelIds.map((id) => ({ id })) } } : {}),
      },
      include: LABEL_INCLUDE,
    });
  }

  findById(id: string) {
    return this.prisma.task.findUnique({ where: { id }, include: LABEL_INCLUDE });
  }

  findByUserId(
    userId: string,
    opts: {
      cursor?: Date;
      limit: number;
      status?: TaskStatus;
      projectId?: string;
      labelId?: string;
    },
  ) {
    const { cursor, limit, status, projectId, labelId } = opts;
    return this.prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
        ...(labelId ? { labels: { some: { id: labelId } } } : {}),
        ...(cursor ? { updatedAt: { lt: cursor } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: LABEL_INCLUDE,
    });
  }

  update(id: string, data: UpdateData) {
    const { labelIds, ...rest } = data;
    return this.prisma.task.update({
      where: { id },
      data: {
        ...rest,
        version: { increment: 1 },
        ...(labelIds ? { labels: { set: labelIds.map((id) => ({ id })) } } : {}),
      },
      include: LABEL_INCLUDE,
    });
  }

  softDelete(id: string) {
    return this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  async findMaxPosition(userId: string) {
    const top = await this.prisma.task.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return top?.position ?? null;
  }

  findNeighborsForReorder(userId: string, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.task.findMany({ where: { userId, deletedAt: null, id: { in: ids } } });
  }

  // Evenly respaces the user's entire task list inside one transaction —
  // the self-healing safeguard for when a reorder's target gap has
  // collapsed below MIN_GAP (see packages/core/src/tasks/position.ts).
  async renumberPositions(userId: string, gap: number) {
    const tasks = await this.prisma.task.findMany({
      where: { userId, deletedAt: null },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    await this.prisma.$transaction(
      tasks.map((task, index) =>
        this.prisma.task.update({
          where: { id: task.id },
          data: { position: (index + 1) * gap },
        }),
      ),
    );
  }
}
