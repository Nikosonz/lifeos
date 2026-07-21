import type {
  IAuditLogRepository,
  IUserRepository,
  CalendarPreference,
  OtpChannel,
} from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";
import { logger } from "../../logging/logger";
import type { OtpService } from "./otp-service";
import type { DeviceInfo } from "./session-service";
import type { SessionService } from "./session-service";

// Event names mirror the audit-log `action` strings on purpose: the audit
// log is the durable, queryable business record (who did what, when); these
// pino calls are the same events for real-time on-call debugging, without a
// DB query. Neither logs the identifier in full — see maskIdentifier below
// — and never the OTP code itself (only the Mock*Provider adapters log the
// code, and only because that's how the mock delivers it in dev/CI; a real
// provider adapter must never do this).
function maskIdentifier(channel: OtpChannel, identifier: string): string {
  if (channel === "EMAIL") {
    const [local, domain] = identifier.split("@");
    if (!local || !domain) return "***";
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return identifier.length > 4
    ? `${identifier.slice(0, -4).replace(/./g, "*")}${identifier.slice(-4)}`
    : identifier;
}

export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
    private readonly userRepository: IUserRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async requestOtp(channel: OtpChannel, identifier: string): Promise<void> {
    await this.otpService.requestOtp(channel, identifier);
    await this.auditLogRepository.record({
      action: "auth.otp.requested",
      metadata: { channel, identifier },
    });
    logger.info(
      { event: "auth.otp.requested", channel, identifier: maskIdentifier(channel, identifier) },
      "otp requested",
    );
  }

  async verifyOtpAndLogin(
    channel: OtpChannel,
    identifier: string,
    code: string,
    device: DeviceInfo,
  ) {
    const user = await this.otpService.verifyOtp(channel, identifier, code);
    const tokens = await this.sessionService.createSession(user.id, device);
    await this.auditLogRepository.record({
      userId: user.id,
      action: "auth.login",
      metadata: { channel, identifier },
    });
    logger.info(
      {
        event: "auth.login",
        userId: user.id,
        channel,
        identifier: maskIdentifier(channel, identifier),
      },
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

  async updateProfile(
    userId: string,
    data: { timezone?: string; calendarPreference?: CalendarPreference },
  ) {
    const user = await this.userRepository.update(userId, data);
    await this.auditLogRepository.record({ userId, action: "auth.profile.updated" });
    logger.info({ event: "auth.profile.updated", userId }, "profile updated");
    return user;
  }

  verifyAccessToken(token: string) {
    return this.sessionService.verifyAccessTokenAndSession(token);
  }
}
