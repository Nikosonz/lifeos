import { authService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const sessions = await authService.listSessions(userId);
  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
    })),
  };
});
