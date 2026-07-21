import { toJalaali, toGregorian } from "jalaali-js";

// Iran has used a single, fixed UTC+03:30 offset with no daylight-saving
// time since 2022 — see docs/decisions/0006-jalaali-js-for-calendar-conversion.md.
// Hardcoded rather than derived from a tz database so this doesn't depend
// on the host's/container's timezone configuration. Revisit if that policy
// ever reverses, or once User's stored `timezone` column is actually wired
// into date-boundary math (currently stored but unused — see the Calendar
// module's documented scope cut).
const TEHRAN_UTC_OFFSET_MINUTES = 210;

export interface JalaliYearMonth {
  year: number;
  month: number; // 1-12, 1 = Farvardin
}

export interface JalaliDate extends JalaliYearMonth {
  day: number;
}

export interface UtcRange {
  gte: Date;
  lt: Date;
}

// Converts a UTC instant to the Jalali year/month it falls in, Tehran-local.
// Deliberately avoids jalaali-js's `toJalaali(date: Date)` overload: that
// reads the Date via getFullYear()/getMonth()/getDate(), which are
// PROCESS-LOCAL-TIMEZONE getters, not UTC ones — the result would silently
// depend on whatever TZ the host/container happens to be configured with.
// Shifting the instant by the fixed Tehran offset first and reading it back
// with UTC getters makes this correct regardless of host TZ.
export function getJalaliYearMonthForInstant(instant: Date): JalaliYearMonth {
  const shifted = new Date(instant.getTime() + TEHRAN_UTC_OFFSET_MINUTES * 60_000);
  const { jy, jm } = toJalaali(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
  return { year: jy, month: jm };
}

// Same instant-to-Jalali conversion as getJalaliYearMonthForInstant, but
// day-inclusive — needed for point-in-time display (e.g. rendering a
// transaction's occurredAt as a Jalali date in a client), as opposed to the
// month-boundary aggregation the year/month-only function was built for.
// Exported for reuse by apps/web's client-side display formatter
// (apps/web/src/lib/format-jalali.ts, a `web-lib` module — allowed to import
// this package for exactly this kind of pure, I/O-free presentation math,
// per eslint.config.js's boundary rules) — this is formatting, not the
// server-side aggregation that must never move to a client.
export function getJalaliDateForInstant(instant: Date): JalaliDate {
  const shifted = new Date(instant.getTime() + TEHRAN_UTC_OFFSET_MINUTES * 60_000);
  const { jy, jm, jd } = toJalaali(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
  return { year: jy, month: jm, day: jd };
}

// Returns the [start, end) UTC instant range for a Jalali month: from
// Tehran-local midnight on the 1st of that month up to (but excluding)
// Tehran-local midnight on the 1st of the next Jalali month. The
// month-12 -> next-year-month-1 rollover falls out of toGregorian directly
// — no month-length lookup or local Date arithmetic needed.
export function jalaaliMonthRangeUtc(year: number, month: number): UtcRange {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return {
    gte: tehranMidnightUtc(year, month, 1),
    lt: tehranMidnightUtc(nextYear, nextMonth, 1),
  };
}

// Converts a Jalali calendar date to the UTC instant of Tehran-local
// midnight on that date. Exported (not just used internally by
// jalaaliMonthRangeUtc) because the Calendar module's static holiday table
// is expressed in Jalali year/month/day and needs the same conversion.
export function tehranMidnightUtc(jy: number, jm: number, jd: number): Date {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return new Date(Date.UTC(gy, gm - 1, gd, 0, 0, 0) - TEHRAN_UTC_OFFSET_MINUTES * 60_000);
}

// Pure calendar-date arithmetic (n may be negative) via a Gregorian
// round-trip — Jalali month lengths vary (29/30/31, leap-year dependent for
// Esfand) so toGregorian/toJalaali already encode that correctly, avoiding
// a hand-rolled Jalali leap-year table here. Promoted from
// packages/core/src/habits/streak.ts (originally just previousJalaliDay)
// now that the Calendar week view is a second consumer of day-arithmetic —
// same "promote to shared once a second module needs it" precedent this
// file's own history (finance/jalali.ts -> shared/jalali.ts) already set.
export function addJalaliDays(date: JalaliDate, n: number): JalaliDate {
  const { gy, gm, gd } = toGregorian(date.year, date.month, date.day);
  const shifted = new Date(Date.UTC(gy, gm - 1, gd + n));
  const { jy, jm, jd } = toJalaali(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
  return { year: jy, month: jm, day: jd };
}

export function previousJalaliDay(date: JalaliDate): JalaliDate {
  return addJalaliDays(date, -1);
}

// JS Date.getDay() convention (0=Sunday..6=Saturday) — same as
// Habit.weekdays and CalendarEvent.recurrenceByWeekday. Calendar-date-only
// math (no Tehran offset involved): a Jalali calendar date's weekday
// doesn't depend on time-of-day, unlike converting a UTC instant to a
// Jalali date (getJalaliDateForInstant above).
export function jalaliWeekday(date: JalaliDate): number {
  const { gy, gm, gd } = toGregorian(date.year, date.month, date.day);
  return new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
}

// The Saturday-start week (per lifeos-domain's "the week starts on
// Saturday, not Sunday or Monday" rule) containing `date`, as its 7 Jalali
// calendar dates, Saturday first.
export function jalaliWeekDays(date: JalaliDate): JalaliDate[] {
  const daysSinceSaturday = (jalaliWeekday(date) + 1) % 7;
  const saturday = addJalaliDays(date, -daysSinceSaturday);
  return Array.from({ length: 7 }, (_, i) => addJalaliDays(saturday, i));
}

// All calendar dates in the Jalali month containing `year`/`month`, in day
// order (28-31 entries depending on the month and leap year) — the
// month-view analogue of jalaliWeekDays. Needed by the Habits module's
// month check-in grid, the same "promote once a second module needs it"
// precedent this file's own history already follows.
export function jalaliMonthDays(year: number, month: number): JalaliDate[] {
  const days: JalaliDate[] = [];
  let cursor: JalaliDate = { year, month, day: 1 };
  while (cursor.year === year && cursor.month === month) {
    days.push(cursor);
    cursor = addJalaliDays(cursor, 1);
  }
  return days;
}

// [start, end) UTC range for the Saturday-start week containing `date` —
// the week-view analogue of jalaaliMonthRangeUtc above.
export function jalaliWeekRangeUtc(date: JalaliDate): UtcRange {
  const days = jalaliWeekDays(date);
  const saturday = days[0]!;
  const nextSaturday = addJalaliDays(saturday, 7);
  return {
    gte: tehranMidnightUtc(saturday.year, saturday.month, saturday.day),
    lt: tehranMidnightUtc(nextSaturday.year, nextSaturday.month, nextSaturday.day),
  };
}
