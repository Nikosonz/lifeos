import { WalletCreateInput } from "@lifeos/contracts";
import { walletService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "./to-response";

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
