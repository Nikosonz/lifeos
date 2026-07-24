import { LabelCreateInput } from "@lifeos/contracts";
import { labelService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "./to-response";

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = LabelCreateInput.parse(await req.json());
  const label = await labelService.createLabel(userId, {
    name: input.name,
    ...(input.color !== undefined ? { color: input.color } : {}),
  });
  return toResponse(label);
});

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const labels = await labelService.listLabels(userId);
  return { labels: labels.map(toResponse) };
});
