import type { IOtpRepository, IUserRepository } from "@lifeos/db";
import { RateLimitedError, UnauthorizedError, ValidationError } from "../../errors/app-error";
import { generateOtpCode, sha256Hex } from "../crypto";
import type { SmsProvider } from "../ports/sms-provider";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

export class OtpService {
  constructor(
    private readonly otpRepository: IOtpRepository,
    private readonly userRepository: IUserRepository,
    private readonly smsProvider: SmsProvider,
  ) {}

  async requestOtp(phone: string): Promise<void> {
    const mostRecent = await this.otpRepository.findMostRecent(phone);
    if (mostRecent && Date.now() - mostRecent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      throw new RateLimitedError("Please wait before requesting another code");
    }

    const code = generateOtpCode();
    const codeHash = sha256Hex(`${phone}:${code}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.otpRepository.create({ phone, codeHash, expiresAt });
    await this.smsProvider.sendOtp(phone, code);
  }

  async verifyOtp(phone: string, code: string) {
    const otp = await this.otpRepository.findLatestActive(phone, new Date());
    if (!otp) throw new ValidationError("No active code for this phone number");
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new RateLimitedError("Too many incorrect attempts — request a new code");
    }

    const codeHash = sha256Hex(`${phone}:${code}`);
    if (codeHash !== otp.codeHash) {
      await this.otpRepository.incrementAttempts(otp.id);
      throw new UnauthorizedError("Incorrect code");
    }

    await this.otpRepository.consume(otp.id);

    const existing = await this.userRepository.findByPhone(phone);
    return existing ?? this.userRepository.create(phone);
  }
}
