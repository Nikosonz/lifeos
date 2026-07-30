import {
  CheckInInput,
  CheckInListQuery,
  CheckInListResponse,
  HabitCheckInResponse,
  OkResponse,
} from "@lifeos/contracts";
import type { CheckInInput as CheckInInputType } from "@lifeos/contracts";
import { habitService } from "@lifeos/core";
import type { HabitCheckIn } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";

function toResponse(checkIn: HabitCheckIn) {
  return {
    id: checkIn.id,
    habitId: checkIn.habitId,
    userId: checkIn.userId,
    jalaliYear: checkIn.jalaliYear,
    jalaliMonth: checkIn.jalaliMonth,
    jalaliDay: checkIn.jalaliDay,
    checkedAt: checkIn.checkedAt.toISOString(),
    createdAt: checkIn.createdAt.toISOString(),
    updatedAt: checkIn.updatedAt.toISOString(),
    deletedAt: checkIn.deletedAt?.toISOString() ?? null,
    version: checkIn.version,
  };
}

function toTargetDate(input: CheckInInputType) {
  return input.jalaliYear !== undefined &&
    input.jalaliMonth !== undefined &&
    input.jalaliDay !== undefined
    ? { year: input.jalaliYear, month: input.jalaliMonth, day: input.jalaliDay }
    : undefined;
}

export const POST = defineRoute(
  { params: ["id"], body: CheckInInput, response: HabitCheckInResponse },
  async ({ userId, params, body: input }) => {
    const { id } = params;
    const checkIn = await habitService.checkIn(id, userId, toTargetDate(input));
    return toResponse(checkIn);
  },
);

export const DELETE = defineRoute(
  { params: ["id"], body: CheckInInput, response: OkResponse },
  async ({ userId, params, body: input }) => {
    const { id } = params;
    await habitService.uncheck(id, userId, toTargetDate(input));
    return { ok: true };
  },
);

export const GET = defineRoute(
  { params: ["id"], query: CheckInListQuery, response: CheckInListResponse },
  async ({ userId, params, query }) => {
    const { id } = params;
    const checkIns = await habitService.listCheckInsForMonth(
      id,
      userId,
      query.jalaliYear,
      query.jalaliMonth,
    );
    return { checkIns: checkIns.map(toResponse) };
  },
);
