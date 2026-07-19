import { test } from "node:test";
import assert from "node:assert/strict";
import { getHolidaysForJalaliYear } from "../src/calendar/holidays";

// Nowruz reference instant matches jalali.test.ts's already-verified
// conversion (1403/1/1 -> 2024-03-19T20:30:00.000Z Tehran-local midnight).

test("getHolidaysForJalaliYear returns Nowruz at the correct UTC instant", () => {
  const holidays = getHolidaysForJalaliYear(1403);
  const nowruz = holidays.find((h) => h.jalaliMonth === 1 && h.jalaliDay === 1);
  assert.ok(nowruz);
  assert.equal(nowruz.date.toISOString(), "2024-03-19T20:30:00.000Z");
  assert.equal(nowruz.jalaliYear, 1403);
});

test("getHolidaysForJalaliYear returns every fixed-date entry with matching year/month/day fields", () => {
  const holidays = getHolidaysForJalaliYear(1404);
  assert.ok(holidays.length > 0);
  for (const holiday of holidays) {
    assert.equal(holiday.jalaliYear, 1404);
    assert.ok(holiday.jalaliMonth >= 1 && holiday.jalaliMonth <= 12);
    assert.ok(holiday.jalaliDay >= 1 && holiday.jalaliDay <= 31);
    assert.ok(holiday.name.length > 0);
  }
});

test("the same holiday falls on a different UTC instant in a different Jalali year", () => {
  const y1403 = getHolidaysForJalaliYear(1403).find(
    (h) => h.jalaliMonth === 1 && h.jalaliDay === 1,
  );
  const y1404 = getHolidaysForJalaliYear(1404).find(
    (h) => h.jalaliMonth === 1 && h.jalaliDay === 1,
  );
  assert.ok(y1403 && y1404);
  assert.notEqual(y1403.date.toISOString(), y1404.date.toISOString());
});

test("no lunar/Hijri holidays are present — only the fixed-Jalali-date table", () => {
  const holidays = getHolidaysForJalaliYear(1403);
  const names = holidays.map((h) => h.name.toLowerCase());
  assert.ok(!names.some((n) => n.includes("eid") || n.includes("ashura") || n.includes("arbaeen")));
});
