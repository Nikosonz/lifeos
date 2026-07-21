import { test } from "node:test";
import assert from "node:assert/strict";
import {
  previousJalaliDay,
  jalaliWeekday,
  calculateStreak,
  type JalaliCalendarDate,
  type CheckedDay,
} from "../src/habits/streak";

// Reference point shared with jalali.test.ts: 1403/1/1 (Nowruz) = 2024-03-20
// Gregorian, which was a Wednesday (JS Date.getUTCDay() = 3).
const NOWRUZ_1403: JalaliCalendarDate = { year: 1403, month: 1, day: 1 };

test("previousJalaliDay steps back across the Esfand 1402 -> Farvardin 1403 year rollover", () => {
  assert.deepEqual(previousJalaliDay(NOWRUZ_1403), { year: 1402, month: 12, day: 29 });
});

test("previousJalaliDay steps back across an ordinary month boundary (Farvardin has 31 days)", () => {
  assert.deepEqual(previousJalaliDay({ year: 1403, month: 2, day: 1 }), {
    year: 1403,
    month: 1,
    day: 31,
  });
});

test("previousJalaliDay steps back within a month", () => {
  assert.deepEqual(previousJalaliDay({ year: 1403, month: 5, day: 15 }), {
    year: 1403,
    month: 5,
    day: 14,
  });
});

test("jalaliWeekday resolves Nowruz 1403 to Wednesday (3)", () => {
  assert.equal(jalaliWeekday(NOWRUZ_1403), 3);
});

function daysBefore(date: JalaliCalendarDate, n: number): JalaliCalendarDate {
  let cursor = date;
  for (let i = 0; i < n; i++) cursor = previousJalaliDay(cursor);
  return cursor;
}

function asChecked(date: JalaliCalendarDate): CheckedDay {
  return { jalaliYear: date.year, jalaliMonth: date.month, jalaliDay: date.day };
}

test("calculateStreak (DAILY): counts consecutive checked days ending today", () => {
  const today = NOWRUZ_1403;
  const checkedDays = [0, 1, 2].map((n) => asChecked(daysBefore(today, n)));
  const streak = calculateStreak({ frequency: "DAILY", weekdays: [] }, checkedDays, today);
  assert.equal(streak, 3);
});

test("calculateStreak (DAILY): forgives today when not yet checked, counting from yesterday", () => {
  const today = NOWRUZ_1403;
  const checkedDays = [1, 2, 3].map((n) => asChecked(daysBefore(today, n)));
  const streak = calculateStreak({ frequency: "DAILY", weekdays: [] }, checkedDays, today);
  assert.equal(streak, 3);
});

test("calculateStreak (DAILY): breaks at the first gap", () => {
  const today = NOWRUZ_1403;
  // Checked today and yesterday, but NOT the day before — a 2-day streak,
  // regardless of older checked days further back.
  const checkedDays = [0, 1, 3, 4].map((n) => asChecked(daysBefore(today, n)));
  const streak = calculateStreak({ frequency: "DAILY", weekdays: [] }, checkedDays, today);
  assert.equal(streak, 2);
});

test("calculateStreak (DAILY): zero when today is unchecked and yesterday is unchecked", () => {
  const today = NOWRUZ_1403;
  const streak = calculateStreak({ frequency: "DAILY", weekdays: [] }, [], today);
  assert.equal(streak, 0);
});

test("calculateStreak (WEEKLY): only scheduled weekdays count, unscheduled days are skipped", () => {
  const today = NOWRUZ_1403; // Wednesday (3)
  // Habit scheduled for Wednesday only. Check today, and the two previous
  // Wednesdays (7 and 14 days back) — Mon/Tue/etc. in between are
  // unscheduled and must not break the streak.
  const checkedDays = [0, 7, 14].map((n) => asChecked(daysBefore(today, n)));
  const streak = calculateStreak({ frequency: "WEEKLY", weekdays: [3] }, checkedDays, today);
  assert.equal(streak, 3);
});

test("calculateStreak (WEEKLY): breaks when a scheduled day was missed", () => {
  const today = NOWRUZ_1403; // Wednesday
  // Today checked, but last week's Wednesday (7 days back) was missed.
  const checkedDays = [0, 14].map((n) => asChecked(daysBefore(today, n)));
  const streak = calculateStreak({ frequency: "WEEKLY", weekdays: [3] }, checkedDays, today);
  assert.equal(streak, 1);
});

test("calculateStreak (WEEKLY): forgives an unscheduled today with no penalty", () => {
  // today is Wednesday but the habit only runs on Mondays (1) — today
  // shouldn't be forgiven-or-not, it's simply irrelevant to the streak.
  const today = NOWRUZ_1403;
  const lastMonday = previousJalaliDay(previousJalaliDay(today)); // Monday, 2 days back
  const streak = calculateStreak(
    { frequency: "WEEKLY", weekdays: [1] },
    [asChecked(lastMonday)],
    today,
  );
  assert.equal(streak, 1);
});

test("calculateStreak (WEEKLY): zero when weekdays is empty", () => {
  const streak = calculateStreak({ frequency: "WEEKLY", weekdays: [] }, [], NOWRUZ_1403);
  assert.equal(streak, 0);
});
