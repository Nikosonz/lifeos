import { HabitUpdateInput, VersionedDeleteInput } from "@lifeos/contracts";
import { habitService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "../to-response";

export const PATCH = defineRoute(
  { params: ["id"], body: HabitUpdateInput },
  async ({ userId, params, body }) => {
    const habit = await habitService.updateHabit(
      params.id,
      userId,
      {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.frequency !== undefined ? { frequency: body.frequency } : {}),
        ...(body.weekdays !== undefined ? { weekdays: body.weekdays } : {}),
      },
      body.expectedVersion,
    );
    return toResponse(habit);
  },
);

export const DELETE = defineRoute(
  { params: ["id"], body: VersionedDeleteInput },
  async ({ userId, params, body }) => {
    await habitService.deleteHabit(params.id, userId, body.expectedVersion);
    return { ok: true };
  },
);
