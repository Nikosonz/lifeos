import { RequestOtpInput } from "@lifeos/contracts";
import { authService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";

export const POST = runRoute(async (req) => {
  const input = RequestOtpInput.parse(await req.json());
  // Exactly one of phone/email is guaranteed by RequestOtpInput's own
  // superRefine — never both, never neither.
  if (input.phone !== undefined) {
    await authService.requestOtp("SMS", input.phone);
  } else {
    await authService.requestOtp("EMAIL", input.email!);
  }
  return { ok: true };
});
