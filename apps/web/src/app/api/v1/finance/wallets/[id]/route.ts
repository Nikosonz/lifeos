import {
  WalletUpdateInput,
  VersionedDeleteInput,
  OkResponse,
  WalletResponse,
} from "@lifeos/contracts";
import { walletService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const GET = defineRoute(
  { params: ["id"], response: WalletResponse },
  async ({ userId, params }) => {
    const { id } = params;
    const wallet = await walletService.getWallet(id, userId);
    return toResponse(wallet);
  },
);

export const PATCH = defineRoute(
  { params: ["id"], body: WalletUpdateInput, response: WalletResponse },
  async ({ userId, params, body: input }) => {
    const { id } = params;
    const wallet = await walletService.updateWallet(
      id,
      userId,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
      },
      input.expectedVersion,
    );
    return toResponse(wallet);
  },
);

export const DELETE = defineRoute(
  { params: ["id"], body: VersionedDeleteInput, response: OkResponse },
  async ({ userId, params, body: { expectedVersion } }) => {
    const { id } = params;
    await walletService.deleteWallet(id, userId, expectedVersion);
    return { ok: true };
  },
);
