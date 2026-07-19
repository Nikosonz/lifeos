import type { SmsProvider } from "../ports/sms-provider";
import { logger } from "../../logging/logger";

// Dev/CI adapter — logs the code instead of sending a real SMS. Swap for a
// Kavenegar/SMS.ir adapter (same SmsProvider interface) once credentials
// exist; nothing else in the auth module changes. Selected via
// SMS_PROVIDER=mock in .env — see auth/container.ts.
export class MockSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    logger.info({ phone, code }, "mock SMS: OTP code (not actually sent)");
  }
}
