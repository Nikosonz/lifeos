import { RequestOtpInput } from "@lifeos/contracts";
import { authService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";

export const POST = runRoute(async (req) => {
  const input = RequestOtpInput.parse(await req.json());
  await authService.requestOtp(input.phone);
  return { ok: true };
});
