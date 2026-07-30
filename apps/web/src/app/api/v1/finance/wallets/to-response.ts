import { Currency } from "@lifeos/contracts";
import type { WalletResponse } from "@lifeos/contracts";
import type { WalletWithBalance } from "@lifeos/core";

// `currency` is the one field the database cannot type for us: the Prisma
// column is a plain `String`, while the contract declares `Currency`
// (`z.enum(["IRR"])`). Nothing checked that they agreed until routes started
// declaring `response`, at which point the mismatch became a compile error
// here rather than a wrong value on the wire. Parsing it — rather than casting
// — means a row holding anything else fails at the mapping boundary, naming
// the field, instead of producing a response no client can parse.
export function toResponse(wallet: WalletWithBalance): WalletResponse {
  return {
    id: wallet.id,
    userId: wallet.userId,
    name: wallet.name,
    currency: Currency.parse(wallet.currency),
    balance: wallet.balance.toString(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
    deletedAt: wallet.deletedAt?.toISOString() ?? null,
    version: wallet.version,
  };
}
