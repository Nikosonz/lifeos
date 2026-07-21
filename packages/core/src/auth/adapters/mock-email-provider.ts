import type { EmailProvider } from "../ports/email-provider";
import { logger } from "../../logging/logger";

// Dev/CI adapter — logs the code instead of sending a real email. Swap for
// a real provider (Resend/SES/etc., same EmailProvider interface) once
// credentials exist; nothing else in the auth module changes. Mirrors
// MockSmsProvider exactly.
export class MockEmailProvider implements EmailProvider {
  async sendOtp(email: string, code: string): Promise<void> {
    logger.info({ email, code }, "mock email: OTP code (not actually sent)");
  }
}
