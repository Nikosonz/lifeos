import { authService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";

export const GET = defineRoute({}, async ({ userId }) => {
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
