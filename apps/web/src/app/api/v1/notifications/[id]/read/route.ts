import { notificationService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";

// Bodiless action verb (no PATCH-able fields, trivially idempotent) — the
// one legitimate exception to this project's resource-path mutation
// convention. See docs/decisions/0009-in-process-notification-dispatch.md.
export const POST = defineRoute({ params: ["id"] }, async ({ userId, params }) => {
  const { id } = params;
  const notification = await notificationService.markRead(id, userId);
  return { id: notification.id, readAt: notification.readAt?.toISOString() ?? null };
});
