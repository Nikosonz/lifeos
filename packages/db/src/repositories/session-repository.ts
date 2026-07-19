import type { PrismaClient, Session } from "../../generated/prisma/index";

export interface ISessionRepository {
  create(data: {
    userId: string;
    refreshTokenHash: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
  }): Promise<Session>;
  findByRefreshTokenHash(hash: string): Promise<Session | null>;
  findById(id: string): Promise<Session | null>;
  findActiveByUser(userId: string): Promise<Session[]>;
  rotate(id: string, newRefreshTokenHash: string, newExpiresAt: Date): Promise<Session>;
  revoke(id: string): Promise<Session>;
}

export class SessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: {
    userId: string;
    refreshTokenHash: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
  }) {
    return this.prisma.session.create({ data });
  }

  findByRefreshTokenHash(hash: string) {
    return this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });
  }

  findById(id: string) {
    return this.prisma.session.findUnique({ where: { id } });
  }

  findActiveByUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastUsedAt: "desc" },
    });
  }

  rotate(id: string, newRefreshTokenHash: string, newExpiresAt: Date) {
    return this.prisma.session.update({
      where: { id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt: newExpiresAt,
      },
    });
  }

  revoke(id: string) {
    return this.prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
