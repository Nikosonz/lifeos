import { Currency } from "@lifeos/contracts";
import type { TransactionResponse } from "@lifeos/contracts";
import type { FinanceTransaction } from "@lifeos/core";

// `currency` is the one field the database cannot type for us: the Prisma
// column is a plain `String`, while the contract declares `Currency`
// (`z.enum(["IRR"])`). Nothing checked that they agreed until routes started
// declaring `response`, at which point the mismatch became a compile error
// here rather than a wrong value on the wire. Parsing it — rather than casting
// — means a row holding anything else fails at the mapping boundary, naming
// the field, instead of producing a response no client can parse.
export function toResponse(tx: FinanceTransaction): TransactionResponse {
  return {
    id: tx.id,
    userId: tx.userId,
    walletId: tx.walletId,
    categoryId: tx.categoryId,
    type: tx.type,
    amount: tx.amount.toString(),
    currency: Currency.parse(tx.currency),
    occurredAt: tx.occurredAt.toISOString(),
    note: tx.note,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    deletedAt: tx.deletedAt?.toISOString() ?? null,
    version: tx.version,
  };
}
