import { CheckInInput, CheckInListQuery } from "@lifeos/contracts";
import type { CheckInInput as CheckInInputType } from "@lifeos/contracts";
import { habitService } from "@lifeos/core";
import type { HabitCheckIn } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

type Ctx = { params: Promise<{ id: string }> };

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

export const POST = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = CheckInInput.parse(await req.json().catch(() => ({})));
  const checkIn = await habitService.checkIn(id, userId, toTargetDate(input));
  return toResponse(checkIn);
});

export const DELETE = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const input = CheckInInput.parse(await req.json().catch(() => ({})));
  await habitService.uncheck(id, userId, toTargetDate(input));
  return { ok: true };
});

export const GET = runRoute<Ctx>(async (req, _requestId, ctx) => {
  const { userId } = await requireUser(req);
  const { id } = await ctx.params;
  const query = CheckInListQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const checkIns = await habitService.listCheckInsForMonth(
    id,
    userId,
    query.jalaliYear,
    query.jalaliMonth,
  );
  return { checkIns: checkIns.map(toResponse) };
});
