import { z } from "zod";
import { SyncFields } from "../common/sync";
import { CursorQuery, paginatedResponse } from "../common/pagination";

// An open string, not a closed enum — see ADR-0011. Notifications' own
// schema file no longer needs an edit every time a new module starts
// triggering notifications; each producing module keeps its own local
// string-literal type for the values it actually sends (e.g. Finance's
// FinanceNotificationEventType in transaction-service.ts).
export const NotificationType = z.string().min(1);
export type NotificationType = z.infer<typeof NotificationType>;

export const NotificationResponse = SyncFields.extend({
  userId: z.uuid(),
  type: NotificationType,
  title: z.string(),
  body: z.string(),
  data: z.unknown().nullable(),
  readAt: z.string().datetime().nullable(),
});
export type NotificationResponse = z.infer<typeof NotificationResponse>;

export const NotificationListQuery = CursorQuery;
export type NotificationListQuery = z.infer<typeof NotificationListQuery>;

export const NotificationListResponse = paginatedResponse(NotificationResponse).extend({
  unreadCount: z.number().int(),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponse>;

export const MarkAllReadResponse = z.object({ updatedCount: z.number().int() });
export type MarkAllReadResponse = z.infer<typeof MarkAllReadResponse>;
