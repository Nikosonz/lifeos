import {
  TransactionUpdateInput,
  IdempotencyKeyHeader,
  OkResponse,
  TransactionResponse,
} from "@lifeos/contracts";
import { transactionService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const GET = defineRoute(
  { params: ["id"], response: TransactionResponse },
  async ({ userId, params }) => {
    const { id } = params;
    const transaction = await transactionService.getTransaction(id, userId);
    return toResponse(transaction);
  },
);

export const PATCH = defineRoute(
  { params: ["id"], body: TransactionUpdateInput, response: TransactionResponse },
  async ({ userId, params, body: input, req }) => {
    const { id } = params;
    const idempotencyKeyHeader = req.headers.get("idempotency-key");
    const idempotencyKey = idempotencyKeyHeader
      ? IdempotencyKeyHeader.parse(idempotencyKeyHeader)
      : undefined;

    const transaction = await transactionService.updateTransaction(
      id,
      userId,
      {
        ...(input.walletId !== undefined ? { walletId: input.walletId } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.amount !== undefined ? { amount: BigInt(input.amount) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.occurredAt !== undefined ? { occurredAt: new Date(input.occurredAt) } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      idempotencyKey,
    );
    return toResponse(transaction);
  },
);

export const DELETE = defineRoute(
  { params: ["id"], response: OkResponse },
  async ({ userId, params }) => {
    const { id } = params;
    await transactionService.deleteTransaction(id, userId);
    return { ok: true };
  },
);
