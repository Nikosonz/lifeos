import { previousJalaliDay, jalaliWeekday, type JalaliDate } from "../shared/jalali";

// Alias kept for this module's own call sites/tests — previousJalaliDay/
// jalaliWeekday were promoted to packages/core/src/shared/jalali.ts once
// the Calendar week view became a second consumer of day-arithmetic (same
// precedent as ADR-0006's finance/jalali.ts -> shared/jalali.ts promotion).
// Re-exported here so existing imports of this module don't need to change.
export type JalaliCalendarDate = JalaliDate;
export { previousJalaliDay, jalaliWeekday };

export type CheckedDay = { jalaliYear: number; jalaliMonth: number; jalaliDay: number };

function key(d: JalaliCalendarDate): string {
  return `${d.year}-${d.month}-${d.day}`;
}

// A streak longer than this is not a real scenario — bounds the backward
// walk so a habit with a sparse or empty check-in history can't loop
// indefinitely.
const MAX_LOOKBACK_DAYS = 3650;

// Current streak length, walking backward day-by-day from `today`.
// - DAILY habits: every calendar day must be checked.
// - WEEKLY habits: only days in `habit.weekdays` count — unscheduled days
//   are skipped without affecting the streak, which only breaks on a
//   scheduled day that wasn't checked.
// Today is forgiven if it's a scheduled day not yet checked (the user
// still has until end of day) — the walk starts from yesterday in that
// case instead of breaking immediately. `checkedDays` need not be
// pre-sorted; only set membership is used.
export function calculateStreak(
  habit: { frequency: "DAILY" | "WEEKLY"; weekdays: number[] },
  checkedDays: CheckedDay[],
  today: JalaliCalendarDate,
): number {
  if (habit.frequency === "WEEKLY" && habit.weekdays.length === 0) return 0;

  const checked = new Set(
    checkedDays.map((d) => `${d.jalaliYear}-${d.jalaliMonth}-${d.jalaliDay}`),
  );
  const isChecked = (d: JalaliCalendarDate) => checked.has(key(d));
  const isScheduled = (d: JalaliCalendarDate) =>
    habit.frequency === "DAILY" || habit.weekdays.includes(jalaliWeekday(d));

  let cursor = today;
  if (isScheduled(cursor) && !isChecked(cursor)) {
    cursor = previousJalaliDay(cursor);
  }

  let streak = 0;
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    if (!isScheduled(cursor)) {
      cursor = previousJalaliDay(cursor);
      continue;
    }
    if (!isChecked(cursor)) break;
    streak += 1;
    cursor = previousJalaliDay(cursor);
  }
  return streak;
}
