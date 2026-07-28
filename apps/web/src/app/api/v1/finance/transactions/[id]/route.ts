import { TransactionUpdateInput, IdempotencyKeyHeader } from "@lifeos/contracts";
import { transactionService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const transaction = await transactionService.getTransaction(id, userId);
  return toResponse(transaction);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const input = TransactionUpdateInput.parse(await req.json());
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
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  await transactionService.deleteTransaction(id, userId);
  return { ok: true };
});
