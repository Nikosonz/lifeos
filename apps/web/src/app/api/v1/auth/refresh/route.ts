import { RefreshInput } from "@lifeos/contracts";
import { authService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";

export const POST = runRoute(async (req) => {
  const input = RefreshInput.parse(await req.json());
  const tokens = await authService.refresh(input.refreshToken);
  return { tokens };
});
