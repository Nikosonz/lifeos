import { WalletCreateInput } from "@lifeos/contracts";
import { walletService } from "@lifeos/core";
import type { WalletWithBalance } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

function toResponse(wallet: WalletWithBalance) {
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

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = WalletCreateInput.parse(await req.json());
  const wallet = await walletService.createWallet(userId, input);
  return toResponse(wallet);
});

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const wallets = await walletService.listWithBalances(userId);
  return { wallets: wallets.map(toResponse) };
});
