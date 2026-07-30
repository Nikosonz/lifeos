import { notificationService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";

export const POST = defineRoute({}, async ({ userId }) => {
  const result = await notificationService.markAllRead(userId);
  return result;
});
