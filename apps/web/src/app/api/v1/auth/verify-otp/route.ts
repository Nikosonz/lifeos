import { VerifyOtpInput } from "@lifeos/contracts";
import { authService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { deviceInfoFromRequest } from "@/lib/auth-context";

export const POST = runRoute(async (req) => {
  const input = VerifyOtpInput.parse(await req.json());
  const { user, tokens } = await authService.verifyOtpAndLogin(
    input.phone,
    input.code,
    deviceInfoFromRequest(req),
  );

  return {
    user: { id: user.id, phone: user.phone, createdAt: user.createdAt.toISOString() },
    tokens,
  };
});
