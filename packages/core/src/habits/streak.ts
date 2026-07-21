import { toJalaali, toGregorian } from "jalaali-js";

export interface JalaliCalendarDate {
  year: number;
  month: number;
  day: number;
}

export type CheckedDay = { jalaliYear: number; jalaliMonth: number; jalaliDay: number };

function key(d: JalaliCalendarDate): string {
  return `${d.year}-${d.month}-${d.day}`;
}

// Pure calendar-date arithmetic — the day immediately before `date`, via a
// Gregorian round-trip since Jalali month lengths vary (29/30/31,
// leap-year dependent for Esfand) and toGregorian/toJalaali already encode
// that correctly, avoiding a hand-rolled Jalali leap-year table here.
export function previousJalaliDay(date: JalaliCalendarDate): JalaliCalendarDate {
  const { gy, gm, gd } = toGregorian(date.year, date.month, date.day);
  const prev = new Date(Date.UTC(gy, gm - 1, gd - 1));
  const { jy, jm, jd } = toJalaali(
    prev.getUTCFullYear(),
    prev.getUTCMonth() + 1,
    prev.getUTCDate(),
  );
  return { year: jy, month: jm, day: jd };
}

// JS Date.getDay() convention (0=Sunday..6=Saturday) — same as
// Habit.weekdays and CalendarEvent.recurrenceByWeekday. Calendar-date-only
// math (no Tehran offset involved): a Jalali calendar date's weekday
// doesn't depend on time-of-day, unlike converting a UTC instant to a
// Jalali date (see shared/jalali.ts).
export function jalaliWeekday(date: JalaliCalendarDate): number {
  const { gy, gm, gd } = toGregorian(date.year, date.month, date.day);
  return new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
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
