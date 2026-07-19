import { authService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const user = await authService.me(userId);
  return { id: user.id, phone: user.phone, createdAt: user.createdAt.toISOString() };
});
