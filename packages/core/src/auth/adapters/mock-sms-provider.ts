import type { SmsProvider } from "../ports/sms-provider";
import { ValidationError } from "../../errors/app-error";
import { logger } from "../../logging/logger";

// Dev/CI adapter — logs the code instead of sending a real SMS. Swap for a
// Kavenegar/SMS.ir adapter (same SmsProvider interface) once credentials
// exist; nothing else in the auth module changes. Selected via
// SMS_PROVIDER=mock in .env — see auth/container.ts.
//
// **It refuses to run in production**, for two independent reasons, either
// of which is sufficient on its own:
//
//  1. Both clients render a phone tab. With a mock behind it, a real user
//     picking phone gets a "code sent" screen and then waits forever for an
//     SMS that was never sent. An immediate, explicit error is the honest
//     answer, and it points them at the channel that does work.
//  2. Logging a live OTP is an authentication bypass for anyone who can
//     read the container logs.
//
// Same fail-closed shape as generateOtpCode()'s DEV_OTP_CODE guard, and for
// the same reason: a silent auth weakness must not be one env var away.
// Delete this guard in the same change that adds the Kavenegar adapter.
export class MockSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new ValidationError("ورود با شماره موبایل هنوز فعال نیست. لطفاً با ایمیل وارد شوید.");
    }
    logger.info({ phone, code }, "mock SMS: OTP code (not actually sent)");
  }
}
