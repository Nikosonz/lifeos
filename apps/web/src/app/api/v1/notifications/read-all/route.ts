import { notificationService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const result = await notificationService.markAllRead(userId);
  return result;
});
