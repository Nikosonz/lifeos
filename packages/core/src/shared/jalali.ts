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
