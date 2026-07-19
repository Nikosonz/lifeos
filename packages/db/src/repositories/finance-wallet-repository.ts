import type { PrismaClient, FinanceWallet } from "../../generated/prisma/index";

export interface IFinanceWalletRepository {
  create(data: { userId: string; name: string; currency: string }): Promise<FinanceWallet>;
  findById(id: string): Promise<FinanceWallet | null>;
  findByUserId(userId: string): Promise<FinanceWallet[]>;
  update(id: string, data: { name?: string }): Promise<FinanceWallet>;
  softDelete(id: string): Promise<FinanceWallet>;
}

export class FinanceWalletRepository implements IFinanceWalletRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: { userId: string; name: string; currency: string }) {
    return this.prisma.financeWallet.create({ data });
  }

  findById(id: string) {
    return this.prisma.financeWallet.findUnique({ where: { id } });
  }

  findByUserId(userId: string) {
    return this.prisma.financeWallet.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  update(id: string, data: { name?: string }) {
    return this.prisma.financeWallet.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  softDelete(id: string) {
    return this.prisma.financeWallet.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }
}
