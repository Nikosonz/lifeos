import type { FinanceTransaction } from "@lifeos/core";

export function toResponse(tx: FinanceTransaction) {
  return {
    id: tx.id,
    userId: tx.userId,
    walletId: tx.walletId,
    categoryId: tx.categoryId,
    type: tx.type,
    amount: tx.amount.toString(),
    currency: tx.currency,
    occurredAt: tx.occurredAt.toISOString(),
    note: tx.note,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    deletedAt: tx.deletedAt?.toISOString() ?? null,
    version: tx.version,
  };
}
