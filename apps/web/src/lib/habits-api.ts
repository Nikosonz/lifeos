import {
  HabitResponse,
  HabitCreateInput,
  HabitUpdateInput,
  HabitCheckInResponse,
  HabitListResponse,
  CheckInListResponse,
  OkResponse,
} from "@lifeos/contracts";
import { apiFetch } from "./api-client";
import type { Versioned } from "./api-client";

export const habitsApi = {
  listHabits: () => apiFetch("/api/v1/habits", { schema: HabitListResponse }),
  createHabit: (input: HabitCreateInput) =>
    apiFetch("/api/v1/habits", { method: "POST", body: input, schema: HabitResponse }),
  updateHabit: (id: string, input: Versioned<HabitUpdateInput>) =>
    apiFetch(`/api/v1/habits/${id}`, { method: "PATCH", body: input, schema: HabitResponse }),
  deleteHabit: (id: string, expectedVersion: number) =>
    apiFetch(`/api/v1/habits/${id}`, {
      method: "DELETE",
      body: { expectedVersion },
      schema: OkResponse,
    }),

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
      schema: OkResponse,
    }),
  listCheckIns: (habitId: string, jalaliYear: number, jalaliMonth: number) =>
    apiFetch(`/api/v1/habits/${habitId}/checkins`, {
      query: { jalaliYear, jalaliMonth },
      schema: CheckInListResponse,
    }),
};
