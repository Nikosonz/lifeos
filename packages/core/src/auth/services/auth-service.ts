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
// DB query. Neither records the identifier in full — see maskIdentifier
// below — and never the OTP code itself (only the Mock*Provider adapters
// log the code, and only because that's how the mock delivers it in
// dev/CI; a real provider adapter must never do this).
//
// **This is applied to stored audit metadata, not just to log lines.**
// `audit_logs` is append-only, has no foreign key to `users` (so it
// deliberately survives account deletion), and has no retention policy
// yet — which made it the one place a raw phone number or email address
// would have outlived the account it belonged to, indefinitely. Masking at
// the point of write is the only fix that holds, because nothing ever
// deletes these rows.
//
// Deliberately masked rather than hashed. A keyed hash would preserve
// "same identifier ⇒ same value" correlation, but it needs its own
// rotatable secret, and rotating it silently breaks every historical
// correlation it existed to provide. An *unkeyed* hash would be worse than
// useless: Iranian mobile numbers occupy roughly 10^9 values, so a rainbow
// table over the whole space is minutes of work. The last four digits plus
// a timestamp is enough to investigate abuse, and is not reversible.
function maskIdentifier(channel: OtpChannel, identifier: string): string {
  if (channel === "EMAIL") {
    const [local, domain] = identifier.split("@");
    if (!local || !domain) return "***";
    // A one- or two-character local part is fully revealed by slice(0, 2),
    // so short locals get masked outright rather than partially.
    if (local.length <= 2) return `***@${domain}`;
    return `${local.slice(0, 2)}***@${domain}`;
  }
  // Anything at or below the reveal width would be returned verbatim, so
  // it is masked entirely instead. The old `> 4` guard returned a short
  // identifier completely unmasked.
  if (identifier.length <= 4) return "***";
  return `${identifier.slice(0, -4).replace(/./g, "*")}${identifier.slice(-4)}`;
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
      metadata: { channel, identifier: maskIdentifier(channel, identifier) },
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
    const { user, isNewUser } = await this.otpService.verifyOtp(channel, identifier, code);
    const tokens = await this.sessionService.createSession(user.id, device);

    // A brand-new account previously recorded only `auth.login`, so the
    // audit log had no way to answer "when was this account created?"
    // except by inference from the earliest login. Registration now gets
    // its own row *in addition to* the login row, rather than replacing
    // it: a signup genuinely is both events, and making them exclusive
    // would put a hole in any "count logins" query over the audit log.
    if (isNewUser) {
      await this.auditLogRepository.record({
        userId: user.id,
        action: "auth.user.created",
        metadata: { channel, identifier: maskIdentifier(channel, identifier) },
      });
      logger.info(
        {
          event: "auth.user.created",
          userId: user.id,
          channel,
          identifier: maskIdentifier(channel, identifier),
        },
        "user account created",
      );
    }

    await this.auditLogRepository.record({
      userId: user.id,
      action: "auth.login",
      metadata: { channel, identifier: maskIdentifier(channel, identifier) },
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
    return { user, tokens, isNewUser };
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
    data: { name?: string | null; timezone?: string; calendarPreference?: CalendarPreference },
  ) {
    const user = await this.userRepository.update(userId, data);
    await this.auditLogRepository.record({ userId, action: "auth.profile.updated" });
    logger.info({ event: "auth.profile.updated", userId }, "profile updated");
    return user;
  }

  /**
   * Permanently deletes the account and everything it owns.
   *
   * Order is deliberate and not interchangeable:
   *
   *   1. Confirm the user exists — so deleting an already-deleted account
   *      returns 404 rather than silently "succeeding" and writing an audit
   *      row for a user that was never there.
   *   2. Write the audit row FIRST. `audit_logs.userId` has no foreign key
   *      to `users` precisely so the record can outlive the account, but a
   *      row written after the delete would still be the only trace of it —
   *      and if the delete succeeded and the audit write then failed, there
   *      would be no record at all. Writing first means the worst case is a
   *      recorded intent that didn't complete, which is the direction to
   *      fail in.
   *   3. Delete. Cascades take every child row with it, including sessions —
   *      which is what actually revokes access. Explicitly revoking sessions
   *      beforehand would be redundant work whose only effect is a wider
   *      window where the account is unusable but still present.
   *
   * There is no soft-delete path and no recovery window. That is a product
   * decision the privacy policy already commits to; if a grace period is
   * ever wanted, it needs its own ADR — reintroducing `User.deletedAt`
   * without teaching `findById` to filter on it would leave deleted accounts
   * fully functional.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User");

    await this.auditLogRepository.record({ userId, action: "auth.user.deleted" });
    await this.userRepository.hardDelete(userId);

    logger.info({ event: "auth.user.deleted", userId }, "user account deleted");
  }

  verifyAccessToken(token: string) {
    return this.sessionService.verifyAccessTokenAndSession(token);
  }
}
