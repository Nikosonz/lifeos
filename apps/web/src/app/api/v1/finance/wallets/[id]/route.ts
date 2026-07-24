import { WalletUpdateInput } from "@lifeos/contracts";
import { walletService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const wallet = await walletService.getWallet(id, userId);
  return toResponse(wallet);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = WalletUpdateInput.parse(await req.json());
  const wallet = await walletService.updateWallet(id, userId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
  });
  return toResponse(wallet);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  await walletService.deleteWallet(id, userId);
  return { ok: true };
});
