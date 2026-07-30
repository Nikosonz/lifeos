import { LabelCreateInput, LabelListResponse, LabelResponse } from "@lifeos/contracts";
import { labelService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "./to-response";

export const POST = defineRoute(
  { body: LabelCreateInput, response: LabelResponse },
  async ({ userId, body: input }) => {
    const label = await labelService.createLabel(userId, {
      name: input.name,
      ...(input.color !== undefined ? { color: input.color } : {}),
    });
    return toResponse(label);
  },
);

export const GET = defineRoute({ response: LabelListResponse }, async ({ userId }) => {
  const labels = await labelService.listLabels(userId);
  return { labels: labels.map(toResponse) };
});
