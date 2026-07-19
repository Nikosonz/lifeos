import type { PrismaClient, OtpCode } from "../../generated/prisma/index";

// Interface exists so packages/core can depend on it instead of the
// concrete Prisma-backed class — that's what lets unit tests pass an
// in-memory fake instead of hitting real Postgres (TS classes with private
// fields aren't structurally assignable from plain object literals).
export interface IOtpRepository {
  create(data: { phone: string; codeHash: string; expiresAt: Date }): Promise<OtpCode>;
  findLatestActive(phone: string, now: Date): Promise<OtpCode | null>;
  findMostRecent(phone: string): Promise<OtpCode | null>;
  incrementAttempts(id: string): Promise<OtpCode>;
  consume(id: string): Promise<OtpCode>;
}

export class OtpRepository implements IOtpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: { phone: string; codeHash: string; expiresAt: Date }) {
    return this.prisma.otpCode.create({ data });
  }

  findLatestActive(phone: string, now: Date) {
    return this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
  }

  findMostRecent(phone: string) {
    return this.prisma.otpCode.findFirst({
      where: { phone },
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
