import { NotificationListQuery } from "@lifeos/contracts";
import { notificationService } from "@lifeos/core";
import type { Notification } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

function toResponse(notification: Notification) {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
    deletedAt: notification.deletedAt?.toISOString() ?? null,
    version: notification.version,
  };
}

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const query = NotificationListQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const [notifications, unreadCount] = await Promise.all([
    notificationService.listForUser(userId, {
      ...(query.cursor !== undefined ? { cursor: new Date(query.cursor) } : {}),
      limit: query.limit,
    }),
    notificationService.getUnreadCount(userId),
  ]);
  const last = notifications[notifications.length - 1];
  const nextCursor =
    notifications.length === query.limit && last ? last.updatedAt.toISOString() : null;
  return { items: notifications.map(toResponse), nextCursor, unreadCount };
});
