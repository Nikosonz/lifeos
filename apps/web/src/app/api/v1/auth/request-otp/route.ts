import { RequestOtpInput } from "@lifeos/contracts";
import { authService, RATE_LIMITS } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";

// The per-IP half of OTP protection. OtpService's own per-identifier
// cooldown stops one number being hammered; this stops one caller walking
// through many different numbers, which is the SMS-bombing gap CLAUDE.md
// lists under Known Limitations. See lib/client-ip.ts for exactly how far
// the IP can be trusted before a reverse proxy exists.
export const POST = runRoute(
  { rateLimit: { bucket: "otp-request", rule: RATE_LIMITS.otpRequestPerIp } },
  async (req) => {
    const input = RequestOtpInput.parse(await req.json());
    // Exactly one of phone/email is guaranteed by RequestOtpInput's own
    // superRefine — never both, never neither.
    if (input.phone !== undefined) {
      await authService.requestOtp("SMS", input.phone);
    } else {
      await authService.requestOtp("EMAIL", input.email!);
    }
    return { ok: true };
  },
);
