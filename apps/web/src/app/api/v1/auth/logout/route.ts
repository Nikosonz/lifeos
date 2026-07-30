import { OkResponse } from "@lifeos/contracts";
import { authService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

export const POST = defineRoute({ response: OkResponse }, async ({ req }) => {
  const { userId, sessionId } = await requireUser(req);
  await authService.logout(sessionId, userId);
  return { ok: true };
});
