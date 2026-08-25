import type { EmailProvider } from "../ports/email-provider";
import { logger } from "../../logging/logger";

// Dev/CI adapter — logs the code instead of sending a real email. The real
// one is ResendEmailProvider, selected by EMAIL_PROVIDER=resend; nothing
// else in the auth module changes between them. Mirrors MockSmsProvider.
//
// Reaching production is a misconfiguration rather than a deliberate state
// (unlike SMS, which has no real adapter yet), so it throws a plain Error:
// there is no useful message for the end user, and printing a live OTP into
// the container log is an authentication bypass for anyone who can read
// logs. env.ts's superRefine is the first line of defence — this is the
// second, because a config guard that can be edited is not a guarantee.
export class MockEmailProvider implements EmailProvider {
  async sendOtp(email: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "MockEmailProvider must never run in production — it logs the OTP instead of sending it. " +
          "Set EMAIL_PROVIDER=resend with RESEND_API_KEY and EMAIL_FROM.",
      );
    }
    logger.info({ email, code }, "mock email: OTP code (not actually sent)");
  }
}
