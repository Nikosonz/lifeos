import { z } from "zod";
import { SyncFields, ExpectedVersion } from "../common/sync";
import { TaskStatus, TaskPriority } from "../tasks/schemas";

export const CalendarRecurrenceFreq = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
export type CalendarRecurrenceFreq = z.infer<typeof CalendarRecurrenceFreq>;

const MAX_RANGE_SPAN_MS = 366 * 24 * 60 * 60 * 1000;

// Shared cross-field checks for both Create (all fields present) and
// Update (partial — cross-field checks only fire when both sides of a
// pair happen to be present in the same call, same minimal-viable
// approach Tasks' rejectSameNeighbor uses for beforeId/afterId).
function validateRecurrence(
  data: {
    startAt?: string | undefined;
    endAt?: string | undefined;
    recurrenceFreq?: CalendarRecurrenceFreq | undefined;
    recurrenceCount?: number | undefined;
    recurrenceUntil?: string | undefined;
    recurrenceByWeekday?: number[] | undefined;
  },
  ctx: z.RefinementCtx,
) {
  if (data.startAt !== undefined && data.endAt !== undefined) {
    if (new Date(data.endAt).getTime() < new Date(data.startAt).getTime()) {
      ctx.addIssue({ code: "custom", message: "endAt must be >= startAt", path: ["endAt"] });
    }
  }
  if (data.recurrenceCount !== undefined && data.recurrenceUntil !== undefined) {
    ctx.addIssue({
      code: "custom",
      message: "recurrenceCount and recurrenceUntil are mutually exclusive",
      path: ["recurrenceUntil"],
    });
  }
  if (
    data.recurrenceByWeekday !== undefined &&
    data.recurrenceByWeekday.length > 0 &&
    data.recurrenceFreq !== "WEEKLY"
  ) {
    ctx.addIssue({
      code: "custom",
      message: "recurrenceByWeekday is only valid when recurrenceFreq is WEEKLY",
      path: ["recurrenceByWeekday"],
    });
  }
}

export const CalendarEventCreateInput = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    allDay: z.boolean().optional(),
    recurrenceFreq: CalendarRecurrenceFreq.optional(),
    recurrenceInterval: z.number().int().min(1).max(365).optional(),
    recurrenceCount: z.number().int().min(1).max(1000).optional(),
    recurrenceUntil: z.string().datetime().optional(),
    recurrenceByWeekday: z.array(z.number().int().min(0).max(6)).optional(),
  })
  .superRefine(validateRecurrence);
export type CalendarEventCreateInput = z.infer<typeof CalendarEventCreateInput>;

export const CalendarEventUpdateInput = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    recurrenceFreq: CalendarRecurrenceFreq.optional(),
    recurrenceInterval: z.number().int().min(1).max(365).optional(),
    recurrenceCount: z.number().int().min(1).max(1000).optional(),
    recurrenceUntil: z.string().datetime().optional(),
    recurrenceByWeekday: z.array(z.number().int().min(0).max(6)).optional(),
    expectedVersion: ExpectedVersion,
  })
  .superRefine(validateRecurrence);
export type CalendarEventUpdateInput = z.infer<typeof CalendarEventUpdateInput>;

export const CalendarEventResponse = SyncFields.extend({
  userId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean(),
  recurrenceFreq: CalendarRecurrenceFreq.nullable(),
  recurrenceInterval: z.number().int(),
  recurrenceCount: z.number().int().nullable(),
  recurrenceUntil: z.string().datetime().nullable(),
  recurrenceByWeekday: z.array(z.number().int()),
});
export type CalendarEventResponse = z.infer<typeof CalendarEventResponse>;

// Accepts either {from,to} (raw ISO instants, for week/day views) or
// {jalaliYear,jalaliMonth} (resolved server-side via the shared
// jalaaliMonthRangeUtc, for a proper Jalali month view) — mutually
// exclusive, mirroring DashboardQuery's existing pattern. The {from,to}
// form is capped at 366 days so a client can't force unbounded
// occurrence-expansion cost server-side.
export const CalendarRangeQuery = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    jalaliYear: z.coerce.number().int().min(1300).max(1500).optional(),
    jalaliMonth: z.coerce.number().int().min(1).max(12).optional(),
  })
  .superRefine((data, ctx) => {
    const hasRange = data.from !== undefined || data.to !== undefined;
    const hasJalali = data.jalaliYear !== undefined || data.jalaliMonth !== undefined;
    if (hasRange && hasJalali) {
      ctx.addIssue({
        code: "custom",
        message: "Provide either from/to or jalaliYear/jalaliMonth, not both",
        path: ["from"],
      });
      return;
    }
    if (!hasRange && !hasJalali) {
      ctx.addIssue({
        code: "custom",
        message: "Provide either from/to or jalaliYear/jalaliMonth",
        path: ["from"],
      });
      return;
    }
    if (hasRange) {
      if (data.from === undefined || data.to === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Both from and to are required together",
          path: ["to"],
        });
        return;
      }
      const span = new Date(data.to).getTime() - new Date(data.from).getTime();
      if (span <= 0) {
        ctx.addIssue({ code: "custom", message: "to must be after from", path: ["to"] });
      } else if (span > MAX_RANGE_SPAN_MS) {
        ctx.addIssue({ code: "custom", message: "Range cannot exceed 366 days", path: ["to"] });
      }
    } else if (data.jalaliYear === undefined || data.jalaliMonth === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Both jalaliYear and jalaliMonth are required together",
        path: ["jalaliMonth"],
      });
    }
  });
export type CalendarRangeQuery = z.infer<typeof CalendarRangeQuery>;

export const CalendarOccurrenceResponse = z.object({
  eventId: z.uuid(),
  title: z.string(),
  occurrenceStart: z.string().datetime(),
  occurrenceEnd: z.string().datetime(),
  allDay: z.boolean(),
  isRecurring: z.boolean(),
});
export type CalendarOccurrenceResponse = z.infer<typeof CalendarOccurrenceResponse>;

// Matches GET /api/v1/calendar/events's real response shape, but no client
// wrapper method calls that endpoint today — the Calendar UI uses the merged
// Agenda view instead. Kept intentionally: this is the contract for a route
// that already exists server-side, not dead code to delete.
export const CalendarEventListResponse = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  items: z.array(CalendarOccurrenceResponse),
});
export type CalendarEventListResponse = z.infer<typeof CalendarEventListResponse>;

// --- Agenda (events + task deadlines + holidays, merged) ---

const CalendarItemBase = {
  title: z.string(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  allDay: z.boolean(),
};

export const CalendarEventItemResponse = z.object({
  source: z.literal("event"),
  ...CalendarItemBase,
  eventId: z.uuid(),
  isRecurring: z.boolean(),
});
export type CalendarEventItemResponse = z.infer<typeof CalendarEventItemResponse>;

export const CalendarTaskItemResponse = z.object({
  source: z.literal("task"),
  ...CalendarItemBase,
  taskId: z.uuid(),
  status: TaskStatus,
  priority: TaskPriority,
});
export type CalendarTaskItemResponse = z.infer<typeof CalendarTaskItemResponse>;

export const CalendarHolidayItemResponse = z.object({
  source: z.literal("holiday"),
  ...CalendarItemBase,
  jalaliYear: z.number().int(),
  jalaliMonth: z.number().int(),
  jalaliDay: z.number().int(),
});
export type CalendarHolidayItemResponse = z.infer<typeof CalendarHolidayItemResponse>;

export const CalendarItemResponse = z.discriminatedUnion("source", [
  CalendarEventItemResponse,
  CalendarTaskItemResponse,
  CalendarHolidayItemResponse,
]);
export type CalendarItemResponse = z.infer<typeof CalendarItemResponse>;

export const CalendarAgendaResponse = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  items: z.array(CalendarItemResponse),
});
export type CalendarAgendaResponse = z.infer<typeof CalendarAgendaResponse>;

// --- Holidays (fixed-Jalali-date only — see packages/core/src/calendar/holidays.ts) ---

export const HolidayQuery = z.object({
  year: z.coerce.number().int().min(1300).max(1500),
});
export type HolidayQuery = z.infer<typeof HolidayQuery>;

export const HolidayResponse = z.object({
  name: z.string(),
  jalaliYear: z.number().int(),
  jalaliMonth: z.number().int(),
  jalaliDay: z.number().int(),
  date: z.string().datetime(),
});
export type HolidayResponse = z.infer<typeof HolidayResponse>;

// Same situation as CalendarEventListResponse above: matches
// GET /api/v1/calendar/holidays's real shape, unconsumed by any client
// wrapper method today (no listHolidays call site exists yet).
export const HolidayListResponse = z.object({
  year: z.number().int(),
  holidays: z.array(HolidayResponse),
});
export type HolidayListResponse = z.infer<typeof HolidayListResponse>;
