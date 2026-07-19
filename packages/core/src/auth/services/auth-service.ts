import type { IAuditLogRepository, IUserRepository } from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";
import type { OtpService } from "./otp-service";
import type { DeviceInfo } from "./session-service";
import type { SessionService } from "./session-service";

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
  }

  async verifyOtpAndLogin(phone: string, code: string, device: DeviceInfo) {
    const user = await this.otpService.verifyOtp(phone, code);
    const tokens = await this.sessionService.createSession(user.id, device);
    await this.auditLogRepository.record({
      userId: user.id,
      action: "auth.login",
      metadata: { phone },
    });
    return { user, tokens };
  }

  refresh(refreshToken: string) {
    return this.sessionService.refresh(refreshToken);
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.sessionService.revoke(sessionId, userId);
    await this.auditLogRepository.record({ userId, action: "auth.logout" });
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
