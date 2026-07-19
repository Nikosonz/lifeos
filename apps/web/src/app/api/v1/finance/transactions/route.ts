import {
  TransactionCreateInput,
  TransactionListQuery,
  IdempotencyKeyHeader,
} from "@lifeos/contracts";
import { transactionService } from "@lifeos/core";
import type { FinanceTransaction } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

function toResponse(tx: FinanceTransaction) {
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

function parseIdempotencyKey(req: Request): string | undefined {
  const header = req.headers.get("idempotency-key");
  return header ? IdempotencyKeyHeader.parse(header) : undefined;
}

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = TransactionCreateInput.parse(await req.json());
  const idempotencyKey = parseIdempotencyKey(req);
  const transaction = await transactionService.createTransaction(
    userId,
    {
      walletId: input.walletId,
      categoryId: input.categoryId,
      type: input.type,
      amount: BigInt(input.amount),
      currency: input.currency,
      occurredAt: new Date(input.occurredAt),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
    idempotencyKey,
  );
  return toResponse(transaction);
});

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const query = TransactionListQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const transactions = await transactionService.listTransactions(userId, {
    ...(query.cursor !== undefined ? { cursor: new Date(query.cursor) } : {}),
    limit: query.limit,
    ...(query.walletId !== undefined ? { walletId: query.walletId } : {}),
    ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
  });
  const last = transactions[transactions.length - 1];
  const nextCursor =
    transactions.length === query.limit && last ? last.updatedAt.toISOString() : null;
  return { items: transactions.map(toResponse), nextCursor };
});
