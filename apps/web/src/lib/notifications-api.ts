import {
  NotificationListResponse,
  MarkAllReadResponse,
  NotificationResponse,
} from "@lifeos/contracts";
import { apiFetch } from "./api-client";

export const notificationsApi = {
  list: (params: { cursor?: string; limit?: number }) =>
    apiFetch("/api/v1/notifications", { query: params, schema: NotificationListResponse }),
  markRead: (id: string) =>
    apiFetch(`/api/v1/notifications/${id}/read`, {
      method: "POST",
      schema: NotificationResponse.pick({ id: true, readAt: true }),
    }),
  markAllRead: () =>
    apiFetch("/api/v1/notifications/read-all", { method: "POST", schema: MarkAllReadResponse }),
};
