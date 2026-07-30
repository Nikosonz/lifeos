import { WalletCreateInput, WalletListResponse, WalletResponse } from "@lifeos/contracts";
import { walletService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "./to-response";

export const POST = defineRoute(
  { body: WalletCreateInput, response: WalletResponse },
  async ({ userId, body: input }) => {
    const wallet = await walletService.createWallet(userId, input);
    return toResponse(wallet);
  },
);

export const GET = defineRoute({ response: WalletListResponse }, async ({ userId }) => {
  const wallets = await walletService.listWithBalances(userId);
  return { wallets: wallets.map(toResponse) };
});
