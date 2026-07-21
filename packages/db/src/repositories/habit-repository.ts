import type { PrismaClient, Habit, HabitFrequency } from "../../generated/prisma/index";

interface CreateData {
  userId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  frequency: HabitFrequency;
  weekdays?: number[];
}

interface UpdateData {
  name?: string;
  description?: string | null;
  color?: string | null;
  frequency?: HabitFrequency;
  weekdays?: number[];
}

export interface IHabitRepository {
  create(data: CreateData): Promise<Habit>;
  findById(id: string): Promise<Habit | null>;
  findByUserId(userId: string): Promise<Habit[]>;
  update(id: string, data: UpdateData): Promise<Habit>;
  softDelete(id: string): Promise<Habit>;
}

export class HabitRepository implements IHabitRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreateData) {
    return this.prisma.habit.create({ data });
  }

  findById(id: string) {
    return this.prisma.habit.findUnique({ where: { id } });
  }

  findByUserId(userId: string) {
    return this.prisma.habit.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  update(id: string, data: UpdateData) {
    return this.prisma.habit.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  softDelete(id: string) {
    return this.prisma.habit.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }
}
