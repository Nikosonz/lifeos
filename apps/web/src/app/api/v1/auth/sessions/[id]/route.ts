import { authService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

// Next.js 16: route params are a Promise — must be awaited.
export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  await authService.revokeSession(id, userId);
  return { ok: true };
});
