import { HabitUpdateInput, VersionedDeleteInput } from "@lifeos/contracts";
import { habitService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { uuidParams } from "@/lib/path-params";
import { requireUser } from "@/lib/auth-context";
import { optionalJsonBody } from "@/lib/optional-body";
import { toResponse } from "../to-response";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const input = HabitUpdateInput.parse(await req.json());
  const habit = await habitService.updateHabit(
    id,
    userId,
    {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
      ...(input.weekdays !== undefined ? { weekdays: input.weekdays } : {}),
    },
    input.expectedVersion,
  );
  return toResponse(habit);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await uuidParams(ctx.params);
  const { expectedVersion } = VersionedDeleteInput.parse(await optionalJsonBody(req));
  await habitService.deleteHabit(id, userId, expectedVersion);
  return { ok: true };
});
