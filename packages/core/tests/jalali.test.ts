import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getJalaliYearMonthForInstant,
  getJalaliDateForInstant,
  jalaaliMonthRangeUtc,
  addJalaliDays,
  previousJalaliDay,
  jalaliWeekday,
  jalaliWeekDays,
  jalaliWeekRangeUtc,
  jalaliMonthDays,
} from "../src/shared/jalali";

// Reference points below are taken directly from jalaali-js's own
// toGregorian output (not derived from memory) — see the conversation
// history for the verification script. 1403/1/1 (Nowruz) = 2024-03-20
// Gregorian, so Tehran-local midnight on that day is 2024-03-19T20:30:00Z
// (UTC+03:30, no DST since 2022).

test("getJalaliYearMonthForInstant resolves the instant just before Nowruz to the prior Esfand", async () => {
  const result = getJalaliYearMonthForInstant(new Date("2024-03-19T20:29:59.999Z"));
  assert.deepEqual(result, { year: 1402, month: 12 });
});

test("getJalaliYearMonthForInstant resolves the instant at Tehran-local midnight of Nowruz to 1403/1", async () => {
  const result = getJalaliYearMonthForInstant(new Date("2024-03-19T20:30:00.000Z"));
  assert.deepEqual(result, { year: 1403, month: 1 });
});

test("jalaaliMonthRangeUtc returns the correct [start, end) range for an ordinary month", async () => {
  const range = jalaaliMonthRangeUtc(1403, 1);
  assert.equal(range.gte.toISOString(), "2024-03-19T20:30:00.000Z");
  assert.equal(range.lt.toISOString(), "2024-04-19T20:30:00.000Z");
});

test("jalaaliMonthRangeUtc handles the month-12 -> next-year-month-1 rollover", async () => {
  const range = jalaaliMonthRangeUtc(1403, 12);
  assert.equal(range.gte.toISOString(), "2025-02-18T20:30:00.000Z");
  assert.equal(range.lt.toISOString(), "2025-03-20T20:30:00.000Z");
});

test("an instant inside a month's range round-trips back to that same year/month", async () => {
  const range = jalaaliMonthRangeUtc(1403, 10);
  const midpoint = new Date((range.gte.getTime() + range.lt.getTime()) / 2);
  assert.deepEqual(getJalaliYearMonthForInstant(midpoint), { year: 1403, month: 10 });
});

test("an instant one millisecond before a month's range falls in the previous month", async () => {
  const range = jalaaliMonthRangeUtc(1403, 10);
  const justBefore = new Date(range.gte.getTime() - 1);
  assert.deepEqual(getJalaliYearMonthForInstant(justBefore), { year: 1403, month: 9 });
});

test("getJalaliDateForInstant resolves Tehran-local midnight of Nowruz to 1403/1/1", async () => {
  const result = getJalaliDateForInstant(new Date("2024-03-19T20:30:00.000Z"));
  assert.deepEqual(result, { year: 1403, month: 1, day: 1 });
});

test("getJalaliDateForInstant resolves the instant just before Nowruz to 1402/12/29 (last day of Esfand)", async () => {
  const result = getJalaliDateForInstant(new Date("2024-03-19T20:29:59.999Z"));
  assert.deepEqual(result, { year: 1402, month: 12, day: 29 });
});

test("getJalaliDateForInstant resolves a mid-month instant correctly", async () => {
  // 1403/10/11 Tehran-local midnight, per jalaaliMonthRangeUtc(1403, 10)'s
  // already-proven gte boundary plus 10 more days (each UTC day here is a
  // clean +24h step since Iran has had no DST since 2022).
  const range = jalaaliMonthRangeUtc(1403, 10);
  const tenDaysIn = new Date(range.gte.getTime() + 10 * 24 * 60 * 60 * 1000);
  assert.deepEqual(getJalaliDateForInstant(tenDaysIn), { year: 1403, month: 10, day: 11 });
});

// Same Nowruz reference as above: 1403/1/1 = 2024-03-20 Gregorian, a
// Wednesday (JS Date.getUTCDay() = 3).
const NOWRUZ_1403 = { year: 1403, month: 1, day: 1 };

test("addJalaliDays steps forward across the Esfand 1402 -> Farvardin 1403 rollover", () => {
  assert.deepEqual(addJalaliDays({ year: 1402, month: 12, day: 29 }, 1), NOWRUZ_1403);
});

test("previousJalaliDay steps back across that same rollover", () => {
  assert.deepEqual(previousJalaliDay(NOWRUZ_1403), { year: 1402, month: 12, day: 29 });
});

test("jalaliWeekday resolves Nowruz 1403 to Wednesday (3)", () => {
  assert.equal(jalaliWeekday(NOWRUZ_1403), 3);
});

test("jalaliWeekDays returns the Saturday-start week containing a Wednesday", () => {
  const days = jalaliWeekDays(NOWRUZ_1403);
  assert.deepEqual(days, [
    { year: 1402, month: 12, day: 26 },
    { year: 1402, month: 12, day: 27 },
    { year: 1402, month: 12, day: 28 },
    { year: 1402, month: 12, day: 29 },
    { year: 1403, month: 1, day: 1 },
    { year: 1403, month: 1, day: 2 },
    { year: 1403, month: 1, day: 3 },
  ]);
  // Every day in the returned week is itself Saturday-start-week-stable:
  // asking for the week containing any of these 7 days returns the same set.
  for (const day of days) {
    assert.deepEqual(jalaliWeekDays(day), days);
  }
});

test("jalaliWeekDays returns the same week regardless of which weekday anchors it", () => {
  // A plain Saturday (weekday 6) should return itself as the first day.
  const saturday = { year: 1402, month: 12, day: 26 };
  assert.equal(jalaliWeekday(saturday), 6);
  assert.deepEqual(jalaliWeekDays(saturday)[0], saturday);
});

test("jalaliWeekRangeUtc spans exactly 7 days, Tehran-local Saturday midnight to the next Saturday midnight", () => {
  const range = jalaliWeekRangeUtc(NOWRUZ_1403);
  assert.equal(range.gte.toISOString(), "2024-03-15T20:30:00.000Z"); // 1402/12/26 Tehran midnight
  assert.equal(range.lt.toISOString(), "2024-03-22T20:30:00.000Z"); // 1403/1/4 Tehran midnight
  assert.equal(range.lt.getTime() - range.gte.getTime(), 7 * 24 * 60 * 60 * 1000);
});

test("jalaliMonthDays returns all 31 days of Farvardin 1403 (months 1-6 are always 31 days)", () => {
  const days = jalaliMonthDays(1403, 1);
  assert.equal(days.length, 31);
  assert.deepEqual(days[0], { year: 1403, month: 1, day: 1 });
  assert.deepEqual(days[days.length - 1], { year: 1403, month: 1, day: 31 });
});

test("jalaliMonthDays returns 29 days for Esfand 1402 (non-leap year, per the Nowruz rollover reference)", () => {
  const days = jalaliMonthDays(1402, 12);
  assert.equal(days.length, 29);
  assert.deepEqual(days[0], { year: 1402, month: 12, day: 1 });
  assert.deepEqual(days[days.length - 1], { year: 1402, month: 12, day: 29 });
});
