import type { ISessionRepository } from "@lifeos/db";
import { UnauthorizedError } from "../../errors/app-error";
import { generateOpaqueToken, sha256Hex } from "../crypto";
import { signAccessToken, verifyAccessToken } from "../jwt";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface DeviceInfo {
  userAgent: string | null;
  ipAddress: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export class SessionService {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async createSession(userId: string, device: DeviceInfo): Promise<AuthTokens> {
    const refreshToken = generateOpaqueToken();
    const refreshTokenHash = sha256Hex(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const session = await this.sessionRepository.create({
      userId,
      refreshTokenHash,
      userAgent: device.userAgent,
      ipAddress: device.ipAddress,
      expiresAt,
    });

    const accessToken = await signAccessToken({ sub: userId, sid: session.id });
    return { accessToken, refreshToken, expiresAt: expiresAt.toISOString() };
  }

  // Rotates the refresh token on every use — a reused (stolen + replayed)
  // token stops working the moment the legitimate client refreshes again.
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const hash = sha256Hex(refreshToken);
    const session = await this.sessionRepository.findByRefreshTokenHash(hash);
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const newRefreshToken = generateOpaqueToken();
    const newHash = sha256Hex(newRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.sessionRepository.rotate(session.id, newHash, expiresAt);

    const accessToken = await signAccessToken({ sub: session.userId, sid: session.id });
    return { accessToken, refreshToken: newRefreshToken, expiresAt: expiresAt.toISOString() };
  }

  // Checked on every request, not just at token-issue time — this is what
  // makes logout/revoke take effect immediately instead of waiting out the
  // access token's 15-minute expiry.
  async verifyAccessTokenAndSession(token: string): Promise<{ userId: string; sessionId: string }> {
    const payload = await verifyAccessToken(token);
    const session = await this.sessionRepository.findById(payload.sid);
    if (!session || session.revokedAt) {
      throw new UnauthorizedError("Session has been revoked");
    }
    return { userId: payload.sub, sessionId: session.id };
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.userId !== userId) throw new UnauthorizedError("Session not found");
    await this.sessionRepository.revoke(sessionId);
  }

  listSessions(userId: string) {
    return this.sessionRepository.findActiveByUser(userId);
  }
}
