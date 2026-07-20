import { Prisma } from "../../generated/prisma/index";
import type { PrismaClient, Notification, NotificationType } from "../../generated/prisma/index";

interface CreateData {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
}

export interface INotificationRepository {
  create(data: CreateData): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByUserId(userId: string, opts: { cursor?: Date; limit: number }): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string): Promise<Notification>;
  markAllRead(userId: string): Promise<number>;
}

export class NotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreateData) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data ?? Prisma.JsonNull,
      },
    });
  }

  findById(id: string) {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  findByUserId(userId: string, opts: { cursor?: Date; limit: number }) {
    const { cursor, limit } = opts;
    return this.prisma.notification.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(cursor ? { updatedAt: { lt: cursor } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({
      where: { userId, deletedAt: null, readAt: null },
    });
  }

  markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), version: { increment: 1 } },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, deletedAt: null, readAt: null },
      data: { readAt: new Date(), version: { increment: 1 } },
    });
    return result.count;
  }
}
