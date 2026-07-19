import { Prisma } from "../../generated/prisma/index";
import type {
  PrismaClient,
  FinanceTransaction,
  FinanceTransactionType,
} from "../../generated/prisma/index";
import { IdempotencyKeyRaceError } from "./idempotency-key-repository";

interface CreateData {
  userId: string;
  walletId: string;
  categoryId: string;
  type: FinanceTransactionType;
  amount: bigint;
  currency: string;
  occurredAt: Date;
  note?: string | null;
}

interface UpdateData {
  walletId?: string;
  categoryId?: string;
  type?: FinanceTransactionType;
  amount?: bigint;
  currency?: string;
  occurredAt?: Date;
  note?: string | null;
}

interface IdempotencyInput {
  key: string;
  requestHash: string;
}

export interface IFinanceTransactionRepository {
  create(data: CreateData): Promise<FinanceTransaction>;
  createWithIdempotency(
    data: CreateData,
    idempotency: IdempotencyInput | null,
  ): Promise<FinanceTransaction>;
  update(id: string, data: UpdateData): Promise<FinanceTransaction>;
  updateWithIdempotency(
    id: string,
    data: UpdateData,
    userId: string,
    idempotency: IdempotencyInput | null,
  ): Promise<FinanceTransaction>;
  findById(id: string): Promise<FinanceTransaction | null>;
  findByUserId(
    userId: string,
    opts: { cursor?: Date; limit: number; walletId?: string; categoryId?: string },
  ): Promise<FinanceTransaction[]>;
  softDelete(id: string): Promise<FinanceTransaction>;
  sumByWallets(
    walletIds: string[],
  ): Promise<Array<{ walletId: string; type: FinanceTransactionType; sum: bigint }>>;
  sumExpenseByCategory(
    userId: string,
    range: { gte: Date; lt: Date },
  ): Promise<Array<{ categoryId: string; sum: bigint }>>;
}

export class FinanceTransactionRepository implements IFinanceTransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreateData) {
    return this.prisma.financeTransaction.create({ data });
  }

  // Atomic: the transaction row and its idempotency-key row are inserted in
  // the same DB transaction, so a losing concurrent request's unique-
  // constraint violation on (userId, key) rolls back BOTH inserts — no
  // orphaned/duplicate transaction row ever survives a race. Callers that
  // pass `idempotency: null` (no header supplied) skip this path entirely.
  async createWithIdempotency(data: CreateData, idempotency: IdempotencyInput | null) {
    if (!idempotency) return this.create(data);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.financeTransaction.create({ data });
        await tx.idempotencyKey.create({
          data: {
            userId: data.userId,
            key: idempotency.key,
            requestHash: idempotency.requestHash,
            resourceType: "finance_transaction",
            resourceId: created.id,
          },
        });
        return created;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new IdempotencyKeyRaceError();
      }
      throw err;
    }
  }

  update(id: string, data: UpdateData) {
    return this.prisma.financeTransaction.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  async updateWithIdempotency(
    id: string,
    data: UpdateData,
    userId: string,
    idempotency: IdempotencyInput | null,
  ) {
    if (!idempotency) return this.update(id, data);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.financeTransaction.update({
          where: { id },
          data: { ...data, version: { increment: 1 } },
        });
        await tx.idempotencyKey.create({
          data: {
            userId,
            key: idempotency.key,
            requestHash: idempotency.requestHash,
            resourceType: "finance_transaction",
            resourceId: updated.id,
          },
        });
        return updated;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new IdempotencyKeyRaceError();
      }
      throw err;
    }
  }

  findById(id: string) {
    return this.prisma.financeTransaction.findUnique({ where: { id } });
  }

  findByUserId(
    userId: string,
    opts: { cursor?: Date; limit: number; walletId?: string; categoryId?: string },
  ) {
    const { cursor, limit, walletId, categoryId } = opts;
    return this.prisma.financeTransaction.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(walletId ? { walletId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(cursor ? { updatedAt: { lt: cursor } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }

  softDelete(id: string) {
    return this.prisma.financeTransaction.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  async sumByWallets(walletIds: string[]) {
    if (walletIds.length === 0) return [];
    const rows = await this.prisma.financeTransaction.groupBy({
      by: ["walletId", "type"],
      where: { walletId: { in: walletIds }, deletedAt: null },
      _sum: { amount: true },
    });
    return rows.map((r) => ({ walletId: r.walletId, type: r.type, sum: r._sum.amount ?? 0n }));
  }

  async sumExpenseByCategory(userId: string, range: { gte: Date; lt: Date }) {
    const rows = await this.prisma.financeTransaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        type: "EXPENSE",
        occurredAt: { gte: range.gte, lt: range.lt },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    return rows.map((r) => ({ categoryId: r.categoryId, sum: r._sum.amount ?? 0n }));
  }
}
