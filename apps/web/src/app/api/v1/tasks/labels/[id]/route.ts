import {
  LabelUpdateInput,
  VersionedDeleteInput,
  LabelResponse,
  OkResponse,
} from "@lifeos/contracts";
import { labelService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const GET = defineRoute(
  { params: ["id"], response: LabelResponse },
  async ({ userId, params }) => {
    const { id } = params;
    const label = await labelService.getLabel(id, userId);
    return toResponse(label);
  },
);

export const PATCH = defineRoute(
  { params: ["id"], body: LabelUpdateInput, response: LabelResponse },
  async ({ userId, params, body: input }) => {
    const { id } = params;
    const label = await labelService.updateLabel(
      id,
      userId,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
      input.expectedVersion,
    );
    return toResponse(label);
  },
);

export const DELETE = defineRoute(
  { params: ["id"], body: VersionedDeleteInput, response: OkResponse },
  async ({ userId, params, body: { expectedVersion } }) => {
    const { id } = params;
    await labelService.deleteLabel(id, userId, expectedVersion);
    return { ok: true };
  },
);
