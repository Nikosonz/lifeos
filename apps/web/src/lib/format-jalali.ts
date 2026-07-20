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

// Locale-independent grouping key (digits only, no Persian-digit
// formatting) for bucketing Agenda items by Jalali calendar day.
export function jalaliDateKey(iso: string): string {
  const { year, month, day } = getJalaliDateForInstant(new Date(iso));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatTimeOfDay(iso: string, locale: "fa" | "en"): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const plain = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return locale === "fa" ? toPersianDigits(plain) : plain;
}
