import type { PrismaClient, OtpCode, OtpChannel } from "../../generated/prisma/index";

// Interface exists so packages/core can depend on it instead of the
// concrete Prisma-backed class — that's what lets unit tests pass an
// in-memory fake instead of hitting real Postgres (TS classes with private
// fields aren't structurally assignable from plain object literals).
//
// `identifier` holds a phone number (channel SMS) or an email address
// (channel EMAIL) — every lookup is scoped by both, so a phone OTP and an
// email OTP can never collide even if the same string somehow matched both
// (it can't in practice, since phone/email have disjoint formats, but the
// scoping makes that a non-issue by construction rather than by convention).
export interface IOtpRepository {
  create(data: {
    channel: OtpChannel;
    identifier: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<OtpCode>;
  findLatestActive(channel: OtpChannel, identifier: string, now: Date): Promise<OtpCode | null>;
  findMostRecent(channel: OtpChannel, identifier: string): Promise<OtpCode | null>;
  incrementAttempts(id: string): Promise<OtpCode>;
  consume(id: string): Promise<OtpCode>;
}

export class OtpRepository implements IOtpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: { channel: OtpChannel; identifier: string; codeHash: string; expiresAt: Date }) {
    return this.prisma.otpCode.create({ data });
  }

  findLatestActive(channel: OtpChannel, identifier: string, now: Date) {
    return this.prisma.otpCode.findFirst({
      where: { channel, identifier, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
  }

  findMostRecent(channel: OtpChannel, identifier: string) {
    return this.prisma.otpCode.findFirst({
      where: { channel, identifier },
      orderBy: { createdAt: "desc" },
    });
  }

  incrementAttempts(id: string) {
    return this.prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  consume(id: string) {
    return this.prisma.otpCode.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
