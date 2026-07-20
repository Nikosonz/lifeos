import { z } from "zod";
import { SyncFields } from "../common/sync";
import { CursorQuery, paginatedResponse } from "../common/pagination";

// Ship with exactly one member — the one trigger wired up this pass (Finance
// budget-exceeded). Additive: a future trigger (task deadline, new-device
// login) adds a value here, never a schema restructure.
export const NotificationType = z.enum(["FINANCE_BUDGET_EXCEEDED"]);
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
