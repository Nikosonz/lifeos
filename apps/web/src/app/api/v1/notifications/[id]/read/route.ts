import { notificationService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

// Bodiless action verb (no PATCH-able fields, trivially idempotent) — the
// one legitimate exception to this project's resource-path mutation
// convention. See docs/decisions/0009-in-process-notification-dispatch.md.
export const POST = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const notification = await notificationService.markRead(id, userId);
  return { id: notification.id, readAt: notification.readAt?.toISOString() ?? null };
});
