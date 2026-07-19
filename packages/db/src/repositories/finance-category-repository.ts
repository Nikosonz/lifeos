import type {
  PrismaClient,
  FinanceCategory,
  FinanceCategoryType,
} from "../../generated/prisma/index";

export interface IFinanceCategoryRepository {
  create(data: {
    userId: string;
    name: string;
    type: FinanceCategoryType;
  }): Promise<FinanceCategory>;
  findById(id: string): Promise<FinanceCategory | null>;
  findByUserId(userId: string): Promise<FinanceCategory[]>;
  findByIds(ids: string[]): Promise<FinanceCategory[]>;
  update(id: string, data: { name?: string }): Promise<FinanceCategory>;
  softDelete(id: string): Promise<FinanceCategory>;
}

export class FinanceCategoryRepository implements IFinanceCategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: { userId: string; name: string; type: FinanceCategoryType }) {
    return this.prisma.financeCategory.create({ data });
  }

  findById(id: string) {
    return this.prisma.financeCategory.findUnique({ where: { id } });
  }

  findByUserId(userId: string) {
    return this.prisma.financeCategory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  findByIds(ids: string[]) {
    return this.prisma.financeCategory.findMany({ where: { id: { in: ids } } });
  }

  update(id: string, data: { name?: string }) {
    return this.prisma.financeCategory.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  softDelete(id: string) {
    return this.prisma.financeCategory.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }
}
