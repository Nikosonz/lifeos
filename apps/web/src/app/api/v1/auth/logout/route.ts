import { authService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

export const POST = runRoute(async (req) => {
  const { userId, sessionId } = await requireUser(req);
  await authService.logout(sessionId, userId);
  return { ok: true };
});
