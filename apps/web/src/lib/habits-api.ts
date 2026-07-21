import { z } from "zod";
import {
  HabitResponse,
  HabitCreateInput,
  HabitUpdateInput,
  HabitCheckInResponse,
} from "@lifeos/contracts";
import { apiFetch } from "./api-client";

// Response wrapper shapes confirmed by reading the actual route handlers
// directly (apps/web/src/app/api/v1/habits/**/route.ts) — both the habit
// list and the check-in list wrap their array in a named key, same split
// tasks-api.ts/finance-api.ts already document for their own modules.
const HabitsListResponse = z.object({ habits: z.array(HabitResponse) });
const CheckInsListResponse = z.object({ checkIns: z.array(HabitCheckInResponse) });

export const habitsApi = {
  listHabits: () => apiFetch("/api/v1/habits", { schema: HabitsListResponse }),
  createHabit: (input: HabitCreateInput) =>
    apiFetch("/api/v1/habits", { method: "POST", body: input, schema: HabitResponse }),
  updateHabit: (id: string, input: HabitUpdateInput) =>
    apiFetch(`/api/v1/habits/${id}`, { method: "PATCH", body: input, schema: HabitResponse }),
  deleteHabit: (id: string) => apiFetch(`/api/v1/habits/${id}`, { method: "DELETE" }),

  // Omitting jalaliYear/Month/Day targets the server's current Jalali day —
  // the month grid always passes an explicit date (including backfilling a
  // past day), the list page's "check in today" toggle passes none.
  checkIn: (
    habitId: string,
    date?: { jalaliYear: number; jalaliMonth: number; jalaliDay: number },
  ) =>
    apiFetch(`/api/v1/habits/${habitId}/checkins`, {
      method: "POST",
      body: date ?? {},
      schema: HabitCheckInResponse,
    }),
  uncheck: (
    habitId: string,
    date?: { jalaliYear: number; jalaliMonth: number; jalaliDay: number },
  ) =>
    apiFetch(`/api/v1/habits/${habitId}/checkins`, {
      method: "DELETE",
      body: date ?? {},
      schema: z.object({ ok: z.boolean() }),
    }),
  listCheckIns: (habitId: string, jalaliYear: number, jalaliMonth: number) =>
    apiFetch(`/api/v1/habits/${habitId}/checkins`, {
      query: { jalaliYear, jalaliMonth },
      schema: CheckInsListResponse,
    }),
};
