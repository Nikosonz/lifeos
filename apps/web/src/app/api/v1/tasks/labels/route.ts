import { LabelCreateInput } from "@lifeos/contracts";
import { labelService } from "@lifeos/core";
import type { TaskLabel } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

function toResponse(label: TaskLabel) {
  return {
    id: label.id,
    userId: label.userId,
    name: label.name,
    color: label.color,
    createdAt: label.createdAt.toISOString(),
    updatedAt: label.updatedAt.toISOString(),
    deletedAt: label.deletedAt?.toISOString() ?? null,
    version: label.version,
  };
}

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
