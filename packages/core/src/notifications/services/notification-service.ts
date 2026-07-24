import type { INotificationRepository, IAuditLogRepository, Notification } from "@lifeos/db";
import type { Prisma } from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";

// `type` is a plain string, not a shared enum — see ADR-0011. Each
// triggering module keeps its own local string-literal type for the values
// it actually sends (e.g. Finance's FinanceNotificationEventType), so a typo
// is still caught at that module's own call site.
export interface CreateNotificationInput {
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
}

// Deliberately domain-agnostic: this service never learns what a "budget" or
// a "task" is. Every trigger's domain knowledge (when to fire, what
// title/body/data to send) lives in the triggering module — see
// FinanceModule's TransactionService and ADR-0009 for the dispatch contract
// (synchronous, in-process, best-effort). There is no client-callable create
// route: no client should be able to manufacture a notification impersonating
// the system, so creation only ever happens as a same-process side effect of
// another core service's call.
export class NotificationService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async create(userId: string, input: CreateNotificationInput): Promise<Notification> {
    const notification = await this.notificationRepository.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      ...(input.data !== undefined ? { data: input.data } : {}),
    });
    await this.auditLogRepository.record({
      userId,
      action: "notifications.notification.created",
      metadata: { notificationId: notification.id, type: input.type },
    });
    return notification;
  }

  listForUser(userId: string, opts: { cursor?: Date; limit: number }): Promise<Notification[]> {
    return this.notificationRepository.findByUserId(userId, opts);
  }

  getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countUnread(userId);
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.getOwned(id, userId);
    if (notification.readAt) return notification;
    const updated = await this.notificationRepository.markRead(id);
    await this.auditLogRepository.record({
      userId,
      action: "notifications.notification.read",
      metadata: { notificationId: id },
    });
    return updated;
  }

  async markAllRead(userId: string): Promise<{ updatedCount: number }> {
    const updatedCount = await this.notificationRepository.markAllRead(userId);
    await this.auditLogRepository.record({
      userId,
      action: "notifications.notification.all_read",
      metadata: { updatedCount },
    });
    return { updatedCount };
  }

  private async getOwned(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findById(id);
    if (!notification || notification.userId !== userId || notification.deletedAt) {
      throw new NotFoundError("Notification");
    }
    return notification;
  }
}
