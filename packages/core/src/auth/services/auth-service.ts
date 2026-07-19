import type { IAuditLogRepository, IUserRepository } from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";
import { logger } from "../../logging/logger";
import type { OtpService } from "./otp-service";
import type { DeviceInfo } from "./session-service";
import type { SessionService } from "./session-service";

// Event names mirror the audit-log `action` strings on purpose: the audit
// log is the durable, queryable business record (who did what, when); these
// pino calls are the same events for real-time on-call debugging, without a
// DB query. Neither logs the phone number in full — see "phone" masking
// below — and never the OTP code itself (only MockSmsProvider logs the
// code, and only because that's how the mock delivers it in dev/CI; a real
// SmsProvider adapter must never do this).
function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, -4).replace(/./g, "*")}${phone.slice(-4)}` : phone;
}

export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
    private readonly userRepository: IUserRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async requestOtp(phone: string): Promise<void> {
    await this.otpService.requestOtp(phone);
    await this.auditLogRepository.record({ action: "auth.otp.requested", metadata: { phone } });
    logger.info({ event: "auth.otp.requested", phone: maskPhone(phone) }, "otp requested");
  }

  async verifyOtpAndLogin(phone: string, code: string, device: DeviceInfo) {
    const user = await this.otpService.verifyOtp(phone, code);
    const tokens = await this.sessionService.createSession(user.id, device);
    await this.auditLogRepository.record({
      userId: user.id,
      action: "auth.login",
      metadata: { phone },
    });
    logger.info(
      { event: "auth.login", userId: user.id, phone: maskPhone(phone) },
      "user logged in",
    );
    return { user, tokens };
  }

  refresh(refreshToken: string) {
    return this.sessionService.refresh(refreshToken);
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.sessionService.revoke(sessionId, userId);
    await this.auditLogRepository.record({ userId, action: "auth.logout" });
    logger.info({ event: "auth.logout", userId, sessionId }, "user logged out");
  }

  listSessions(userId: string) {
    return this.sessionService.listSessions(userId);
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.sessionService.revoke(sessionId, userId);
    await this.auditLogRepository.record({
      userId,
      action: "auth.session.revoked",
      metadata: { sessionId },
    });
    logger.info({ event: "auth.session.revoked", userId, sessionId }, "session revoked");
  }

  async me(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User");
    return user;
  }

  verifyAccessToken(token: string) {
    return this.sessionService.verifyAccessTokenAndSession(token);
  }
}
