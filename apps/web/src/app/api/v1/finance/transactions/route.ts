import {
  TransactionCreateInput,
  TransactionListQuery,
  IdempotencyKeyHeader,
  TransactionListResponse,
  TransactionResponse,
} from "@lifeos/contracts";
import { transactionService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "./to-response";

function parseIdempotencyKey(req: Request): string | undefined {
  const header = req.headers.get("idempotency-key");
  return header ? IdempotencyKeyHeader.parse(header) : undefined;
}

export const POST = defineRoute(
  { body: TransactionCreateInput, response: TransactionResponse },
  async ({ userId, body: input, req }) => {
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
  },
);

export const GET = defineRoute(
  { query: TransactionListQuery, response: TransactionListResponse },
  async ({ userId, query }) => {
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
  },
);
