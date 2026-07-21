import { VerifyOtpInput } from "@lifeos/contracts";
import { authService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { deviceInfoFromRequest } from "@/lib/auth-context";

export const POST = runRoute(async (req) => {
  const input = VerifyOtpInput.parse(await req.json());
  const device = deviceInfoFromRequest(req);

  // Exactly one of phone/email is guaranteed by VerifyOtpInput's own
  // superRefine — never both, never neither.
  const { user, tokens } =
    input.phone !== undefined
      ? await authService.verifyOtpAndLogin("SMS", input.phone, input.code, device)
      : await authService.verifyOtpAndLogin("EMAIL", input.email!, input.code, device);

  return {
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    tokens,
  };
});
