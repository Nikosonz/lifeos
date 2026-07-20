import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getJalaliYearMonthForInstant,
  getJalaliDateForInstant,
  jalaaliMonthRangeUtc,
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
