import { RefreshInput } from "@lifeos/contracts";
import { authService, RATE_LIMITS } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";

// The opaque refresh token *is* the credential here (there's no Bearer
// header to check first), making this the other endpoint worth guarding
// against brute force.
export const POST = runRoute(
  { rateLimit: { bucket: "refresh", rule: RATE_LIMITS.refreshPerIp } },
  async (req) => {
    const input = RefreshInput.parse(await req.json());
    const tokens = await authService.refresh(input.refreshToken);
    return { tokens };
  },
);
