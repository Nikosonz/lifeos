import { authService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";

// Next.js 16: route params are a Promise — must be awaited.
export const DELETE = defineRoute({ params: ["id"] }, async ({ userId, params }) => {
  const { id } = params;
  await authService.revokeSession(id, userId);
  return { ok: true };
});
