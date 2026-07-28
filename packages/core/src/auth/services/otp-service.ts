import { timingSafeEqual } from "node:crypto";
import type { IOtpRepository, IUserRepository, OtpChannel } from "@lifeos/db";
import { RateLimitedError, UnauthorizedError, ValidationError } from "../../errors/app-error";
import { OTP_RESEND_COOLDOWN_MS } from "../../rate-limit/policies";
import type { RateLimitService } from "../../rate-limit/services/rate-limit-service";
import { generateOtpCode, sha256Hex } from "../crypto";
import type { SmsProvider } from "../ports/sms-provider";
import type { EmailProvider } from "../ports/email-provider";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// `identifier` is a phone number when channel is SMS, an email address when
// channel is EMAIL — everything else about issuing/verifying an OTP
// (cooldown, attempt limit, expiry, hashing) is identical either way, so
// this service stays channel-agnostic rather than branching on it except at
// the two points that genuinely differ: which provider delivers the code,
// and which user-repository method looks up/creates the account.
export class OtpService {
  constructor(
    private readonly otpRepository: IOtpRepository,
    private readonly userRepository: IUserRepository,
    private readonly smsProvider: SmsProvider,
    private readonly emailProvider: EmailProvider,
    private readonly rateLimitService: RateLimitService,
  ) {}

  // The resend cooldown was a read-then-write against Postgres
  // (findMostRecent, compare timestamps, then create) — two concurrent
  // requests both read "no recent code" and both passed, which is exactly
  // the race docs/roadmap.md Phase 5 called out. claimCooldown() is a
  // single atomic store operation, so exactly one of N concurrent callers
  // can win.
  //
  // The old timestamp check is kept as a fallback for one specific case:
  // claimCooldown() returns false without throwing only when the store
  // itself is unavailable and failed open. Enforcing the racy-but-real
  // Postgres check in that window is strictly better than enforcing
  // nothing — a cooldown is the only thing standing between a caller and
  // unbounded SMS spend, so it degrades rather than disappearing.
  private async enforceResendCooldown(channel: OtpChannel, identifier: string): Promise<void> {
    const claimed = await this.rateLimitService.claimCooldown(
      "otp-resend",
      `${channel}:${identifier}`,
      OTP_RESEND_COOLDOWN_MS,
      "Please wait before requesting another code",
    );
    if (claimed) return;

    const mostRecent = await this.otpRepository.findMostRecent(channel, identifier);
    if (mostRecent && Date.now() - mostRecent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      throw new RateLimitedError("Please wait before requesting another code");
    }
  }

  async requestOtp(channel: OtpChannel, identifier: string): Promise<void> {
    await this.enforceResendCooldown(channel, identifier);

    const code = generateOtpCode();
    // Namespaced by channel as well as identifier — phone/email formats
    // never actually collide, but this makes that a non-issue by
    // construction rather than by convention.
    const codeHash = sha256Hex(`${channel}:${identifier}:${code}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.otpRepository.create({ channel, identifier, codeHash, expiresAt });

    if (channel === "SMS") {
      await this.smsProvider.sendOtp(identifier, code);
    } else {
      await this.emailProvider.sendOtp(identifier, code);
    }
  }

  async verifyOtp(channel: OtpChannel, identifier: string, code: string) {
    const otp = await this.otpRepository.findLatestActive(channel, identifier, new Date());
    if (!otp) throw new ValidationError("No active code for this identifier");
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new RateLimitedError("Too many incorrect attempts — request a new code");
    }

    // Constant-time compare — both sides are fixed-length SHA-256 hex
    // digests, so this can't leak per-character timing information.
    const codeHash = Buffer.from(sha256Hex(`${channel}:${identifier}:${code}`));
    const storedHash = Buffer.from(otp.codeHash);
    if (codeHash.length !== storedHash.length || !timingSafeEqual(codeHash, storedHash)) {
      await this.otpRepository.incrementAttempts(otp.id);
      throw new UnauthorizedError("Incorrect code");
    }

    await this.otpRepository.consume(otp.id);

    if (channel === "SMS") {
      const existing = await this.userRepository.findByPhone(identifier);
      return existing ?? this.userRepository.createWithPhone(identifier);
    }
    const existing = await this.userRepository.findByEmail(identifier);
    return existing ?? this.userRepository.createWithEmail(identifier);
  }
}
