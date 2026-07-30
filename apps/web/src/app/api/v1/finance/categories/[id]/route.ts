import {
  CategoryUpdateInput,
  VersionedDeleteInput,
  CategoryResponse,
  OkResponse,
} from "@lifeos/contracts";
import { categoryService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const PATCH = defineRoute(
  { params: ["id"], body: CategoryUpdateInput, response: CategoryResponse },
  async ({ userId, params, body: input }) => {
    const { id } = params;
    const category = await categoryService.updateCategory(
      id,
      userId,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
      },
      input.expectedVersion,
    );
    return toResponse(category);
  },
);

export const DELETE = defineRoute(
  { params: ["id"], body: VersionedDeleteInput, response: OkResponse },
  async ({ userId, params, body: { expectedVersion } }) => {
    const { id } = params;
    await categoryService.deleteCategory(id, userId, expectedVersion);
    return { ok: true };
  },
);
