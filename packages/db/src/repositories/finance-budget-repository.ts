import type { PrismaClient, FinanceBudget } from "../../generated/prisma/index";
import { runVersionedWrite, versionedWhere } from "./optimistic-concurrency";

export interface IFinanceBudgetRepository {
  upsert(data: {
    userId: string;
    categoryId: string;
    jalaliYear: number;
    jalaliMonth: number;
    limitAmount: bigint;
    currency: string;
  }): Promise<FinanceBudget>;
  findByUserAndPeriod(
    userId: string,
    jalaliYear: number,
    jalaliMonth: number,
  ): Promise<FinanceBudget[]>;
  findById(id: string): Promise<FinanceBudget | null>;
  update(
    id: string,
    data: { limitAmount?: bigint },
    expectedVersion?: number,
  ): Promise<FinanceBudget>;
  softDelete(id: string, expectedVersion?: number): Promise<FinanceBudget>;
}

export class FinanceBudgetRepository implements IFinanceBudgetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  upsert(data: {
    userId: string;
    categoryId: string;
    jalaliYear: number;
    jalaliMonth: number;
    limitAmount: bigint;
    currency: string;
  }) {
    const { userId, categoryId, jalaliYear, jalaliMonth, limitAmount, currency } = data;
    return this.prisma.financeBudget.upsert({
      where: {
        userId_categoryId_jalaliYear_jalaliMonth: { userId, categoryId, jalaliYear, jalaliMonth },
      },
      create: { userId, categoryId, jalaliYear, jalaliMonth, limitAmount, currency },
      update: { limitAmount, currency, version: { increment: 1 } },
    });
  }

  findByUserAndPeriod(userId: string, jalaliYear: number, jalaliMonth: number) {
    return this.prisma.financeBudget.findMany({
      where: { userId, jalaliYear, jalaliMonth, deletedAt: null },
    });
  }

  findById(id: string) {
    return this.prisma.financeBudget.findUnique({ where: { id } });
  }

  update(id: string, data: { limitAmount?: bigint }, expectedVersion?: number) {
    return runVersionedWrite(
      () =>
        this.prisma.financeBudget.update({
          where: versionedWhere(id, expectedVersion),
          data: { ...data, version: { increment: 1 } },
        }),
      () => this.prisma.financeBudget.findUnique({ where: { id }, select: { version: true } }),
    );
  }

  softDelete(id: string, expectedVersion?: number) {
    return runVersionedWrite(
      () =>
        this.prisma.financeBudget.update({
          where: versionedWhere(id, expectedVersion),
          data: { deletedAt: new Date(), version: { increment: 1 } },
        }),
      () => this.prisma.financeBudget.findUnique({ where: { id }, select: { version: true } }),
    );
  }
}
