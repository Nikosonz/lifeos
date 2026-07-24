// Deep import, deliberately bypassing @lifeos/core's barrel (`"@lifeos/core"`
// re-exports every module's container.ts, several of which import
// @lifeos/db -> the generated Prisma client -> Node's `async_hooks`, which
// doesn't exist in a browser bundle). This file is imported from client
// components (Finance pages), so pulling in the barrel breaks the client
// build with "Module not found: can't resolve 'async_hooks'" — caught by
// actually running the app, not by typecheck or lint. shared/jalali.ts has
// zero @lifeos/db dependency of its own (pure date math + jalaali-js only),
// so importing it directly is safe; packages/core has no `exports` map, so
// this subpath resolves under bundler moduleResolution without issue.
import {
  getJalaliDateForInstant,
  getJalaliYearMonthForInstant,
  type JalaliDate,
} from "@lifeos/core/src/shared/jalali";
import { toPersianDigits } from "./format-money";

// Reusing packages/core's pure Jalali conversion math for DISPLAY
// formatting (not aggregation) is deliberate, in-bounds reuse: `web-lib` is
// allowed to import `core` per eslint.config.js's boundary rules, and
// reimplementing the same instant->Jalali conversion here would either
// duplicate `packages/core/src/shared/jalali.ts`'s fixed-Tehran-offset/
// UTC-getter discipline or risk silently reintroducing the exact
// process-local-timezone bug that file's own comments document having
// fixed once already. The actual budget/transaction aggregation stays
// 100% server-side — this file only turns an instant into display text.

const JALALI_MONTH_NAMES_FA = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const JALALI_MONTH_NAMES_EN = [
  "Farvardin",
  "Ordibehesht",
  "Khordad",
  "Tir",
  "Mordad",
  "Shahrivar",
  "Mehr",
  "Aban",
  "Azar",
  "Dey",
  "Bahman",
  "Esfand",
];

export function formatJalaliDate(iso: string, locale: "fa" | "en"): string {
  const { year, month, day } = getJalaliDateForInstant(new Date(iso));
  const parts = [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")];
  const plain = parts.join("/");
  return locale === "fa" ? toPersianDigits(plain) : plain;
}

export function formatJalaliMonthLabel(year: number, month: number, locale: "fa" | "en"): string {
  const names = locale === "fa" ? JALALI_MONTH_NAMES_FA : JALALI_MONTH_NAMES_EN;
  const name = names[month - 1] ?? String(month);
  return locale === "fa" ? `${name} ${toPersianDigits(String(year))}` : `${name} ${year}`;
}

export function currentJalaliYearMonth(): { year: number; month: number } {
  return getJalaliYearMonthForInstant(new Date());
}

export function currentJalaliDate(): JalaliDate {
  return getJalaliDateForInstant(new Date());
}

// Small convenience wrapper around toPersianDigits for the common
// "format this plain number for the current locale" case (e.g. a Week view
// day-of-month cell) — every other digit-formatting call site in this file
// already does this same locale ? toPersianDigits(...) : n ternary inline.
export function toPersianDigitsForLocale(n: number, locale: "fa" | "en"): string {
  return locale === "fa" ? toPersianDigits(String(n)) : String(n);
}

// Compact "26 Esf – 3 Far 1403"-style label for the Week view's nav row,
// spanning the first and last of a Saturday-start week (7 entries, as
// returned by @lifeos/core's jalaliWeekDays).
export function formatJalaliWeekLabel(weekDays: JalaliDate[], locale: "fa" | "en"): string {
  const names = locale === "fa" ? JALALI_MONTH_NAMES_FA : JALALI_MONTH_NAMES_EN;
  const first = weekDays[0]!;
  const last = weekDays[weekDays.length - 1]!;
  const formatDay = (d: JalaliDate) => {
    const day = locale === "fa" ? toPersianDigits(String(d.day)) : String(d.day);
    return `${day} ${names[d.month - 1] ?? d.month}`;
  };
  const year = locale === "fa" ? toPersianDigits(String(last.year)) : String(last.year);
  return `${formatDay(first)} – ${formatDay(last)} ${year}`;
}

// Locale-independent grouping key (digits only, no Persian-digit
// formatting) for bucketing Agenda items by Jalali calendar day.
export function jalaliDateKey(iso: string): string {
  const { year, month, day } = getJalaliDateForInstant(new Date(iso));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Same grouping key as jalaliDateKey, but from an already-known
// {year,month,day} triple (the Week view's day columns come from
// jalaliWeekDays, not from re-parsing an item's ISO instant) rather than an
// ISO instant — kept as a separate function so callers with either shape
// don't have to round-trip through a fake ISO string.
export function jalaliDateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Maps a JS Date.getDay() weekday index (0=Sunday..6=Saturday) to the full
// weekday{Sun..Sat} translation key — shared by every weekday-selection UI
// (Calendar's Week view day headers, event/habit recurrence weekday
// pickers), which all get their weekday from a plain number (either
// @lifeos/core's jalaliWeekday or the same 0..6 convention), not from
// next-intl directly.
export const WEEKDAY_KEY: Record<number, string> = {
  0: "weekdaySun",
  1: "weekdayMon",
  2: "weekdayTue",
  3: "weekdayWed",
  4: "weekdayThu",
  5: "weekdayFri",
  6: "weekdaySat",
};

export const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

export function formatTimeOfDay(iso: string, locale: "fa" | "en"): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const plain = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return locale === "fa" ? toPersianDigits(plain) : plain;
}
