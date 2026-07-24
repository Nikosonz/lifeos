import type { WalletWithBalance } from "@lifeos/core";

export function toResponse(wallet: WalletWithBalance) {
  return {
    id: wallet.id,
    userId: wallet.userId,
    name: wallet.name,
    currency: wallet.currency,
    balance: wallet.balance.toString(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
    deletedAt: wallet.deletedAt?.toISOString() ?? null,
    version: wallet.version,
  };
}
