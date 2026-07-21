import { z } from "zod";
import { SyncFields } from "../common/sync";

export const HabitFrequency = z.enum(["DAILY", "WEEKLY"]);
export type HabitFrequency = z.infer<typeof HabitFrequency>;

// weekdays is only meaningful when frequency is WEEKLY (0=Sunday..6=Saturday,
// same JS Date.getDay() convention as CalendarEvent.recurrenceByWeekday) —
// validated together via superRefine, mirroring the Calendar module's
// recurrenceByWeekday/recurrenceFreq pairing.
function validateWeekdays(
  data: { frequency: HabitFrequency; weekdays?: number[] | undefined },
  ctx: z.RefinementCtx,
) {
  if (data.frequency === "WEEKLY" && (!data.weekdays || data.weekdays.length === 0)) {
    ctx.addIssue({
      code: "custom",
      message: "weekdays is required and non-empty when frequency is WEEKLY",
      path: ["weekdays"],
    });
  }
  if (data.frequency === "DAILY" && data.weekdays !== undefined && data.weekdays.length > 0) {
    ctx.addIssue({
      code: "custom",
      message: "weekdays is only valid when frequency is WEEKLY",
      path: ["weekdays"],
    });
  }
}

export const HabitCreateInput = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    color: z.string().max(20).optional(),
    frequency: HabitFrequency,
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  })
  .superRefine(validateWeekdays);
export type HabitCreateInput = z.infer<typeof HabitCreateInput>;

export const HabitUpdateInput = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  frequency: HabitFrequency.optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
});
export type HabitUpdateInput = z.infer<typeof HabitUpdateInput>;

export const HabitResponse = SyncFields.extend({
  userId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  frequency: HabitFrequency,
  weekdays: z.array(z.number().int()),
  streak: z.number().int(),
  checkedToday: z.boolean(),
});
export type HabitResponse = z.infer<typeof HabitResponse>;

export const HabitListResponse = z.object({
  habits: z.array(HabitResponse),
});
export type HabitListResponse = z.infer<typeof HabitListResponse>;

// --- Check-ins ---

// A client may target an explicit past day (e.g. backfilling a forgotten
// check-in from a calendar view) — omitting all three defaults to the
// server's current Jalali day. This is ordinary user input (which day
// happened), not client-computed business logic (the server still owns
// streak math). All-or-nothing: a partial date is ambiguous, not a valid
// "use today" signal.
export const CheckInInput = z
  .object({
    jalaliYear: z.number().int().optional(),
    jalaliMonth: z.number().int().min(1).max(12).optional(),
    jalaliDay: z.number().int().min(1).max(31).optional(),
  })
  .superRefine((data, ctx) => {
    const provided = [data.jalaliYear, data.jalaliMonth, data.jalaliDay].filter(
      (v) => v !== undefined,
    ).length;
    if (provided !== 0 && provided !== 3) {
      ctx.addIssue({
        code: "custom",
        message: "jalaliYear/jalaliMonth/jalaliDay must be all provided or all omitted",
        path: ["jalaliDay"],
      });
    }
  });
export type CheckInInput = z.infer<typeof CheckInInput>;

export const HabitCheckInResponse = SyncFields.extend({
  habitId: z.uuid(),
  userId: z.uuid(),
  jalaliYear: z.number().int(),
  jalaliMonth: z.number().int(),
  jalaliDay: z.number().int(),
  checkedAt: z.string().datetime(),
});
export type HabitCheckInResponse = z.infer<typeof HabitCheckInResponse>;

export const CheckInListQuery = z.object({
  jalaliYear: z.coerce.number().int(),
  jalaliMonth: z.coerce.number().int().min(1).max(12),
});
export type CheckInListQuery = z.infer<typeof CheckInListQuery>;

export const CheckInListResponse = z.object({
  checkIns: z.array(HabitCheckInResponse),
});
export type CheckInListResponse = z.infer<typeof CheckInListResponse>;
