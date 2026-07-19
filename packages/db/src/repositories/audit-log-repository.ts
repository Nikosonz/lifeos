import { Prisma } from "../../generated/prisma/index";
import type { PrismaClient, AuditLog } from "../../generated/prisma/index";

export interface IAuditLogRepository {
  record(data: {
    userId?: string | null;
    action: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<AuditLog>;
}

export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  record(data: { userId?: string | null; action: string; metadata?: Prisma.InputJsonValue }) {
    return this.prisma.auditLog.create({
      data: {
        userId: data.userId ?? null,
        action: data.action,
        metadata: data.metadata ?? Prisma.JsonNull,
      },
    });
  }
}
