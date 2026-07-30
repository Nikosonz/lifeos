import { WalletUpdateInput, VersionedDeleteInput } from "@lifeos/contracts";
import { walletService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { optionalJsonBody } from "@/lib/optional-body";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const wallet = await walletService.getWallet(id, userId);
  return toResponse(wallet);
});

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const input = WalletUpdateInput.parse(await req.json());
  const wallet = await walletService.updateWallet(
    id,
    userId,
    {
      ...(input.name !== undefined ? { name: input.name } : {}),
    },
    input.expectedVersion,
  );
  return toResponse(wallet);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const { expectedVersion } = VersionedDeleteInput.parse(await optionalJsonBody(req));
  await walletService.deleteWallet(id, userId, expectedVersion);
  return { ok: true };
});
