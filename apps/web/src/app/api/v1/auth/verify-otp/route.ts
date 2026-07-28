import { VerifyOtpInput } from "@lifeos/contracts";
import { authService, RATE_LIMITS } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { deviceInfoFromRequest } from "@/lib/auth-context";

// OtpService locks a single code after 5 wrong guesses, but that's
// per-code: requesting a fresh code buys 5 more. This caps the total guess
// rate from one source however many codes it cycles through.
export const POST = runRoute(
  { rateLimit: { bucket: "otp-verify", rule: RATE_LIMITS.otpVerifyPerIp } },
  async (req) => {
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
  },
);
