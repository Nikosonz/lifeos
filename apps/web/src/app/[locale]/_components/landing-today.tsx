"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { jalaliWeekDays, type JalaliDate } from "@lifeos/core/src/shared/jalali";
import { currentJalaliDate, jalaliMonthName, toPersianDigitsForLocale } from "@/lib/format-jalali";

// The signature element: today's real Jalali date, rendered live, in the
// Persian display face — the product's whole thesis ("your own calendar")
// shown rather than described. Computed from the exact same core helpers
// the app's Finance/Calendar aggregation uses, so the landing literally
// runs the product.
//
// Client-only + mount-gated on purpose: the date must be the VIEWER's
// today, never a build-time-frozen value from static generation, and
// deferring to useEffect guarantees no server/client hydration mismatch.
// The frame reserves its space so filling it causes no layout shift.

const WEEKDAY_SHORT_FA = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
const WEEKDAY_SHORT_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

function sameDay(a: JalaliDate, b: JalaliDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function LandingToday() {
  const locale = useLocale() as "fa" | "en";
  const t = useTranslations("Landing");
  const [today, setToday] = useState<JalaliDate | null>(null);

  useEffect(() => {
    setToday(currentJalaliDate());
  }, []);

  const weekNames = locale === "fa" ? WEEKDAY_SHORT_FA : WEEKDAY_SHORT_EN;
  const week = today ? jalaliWeekDays(today) : null;

  return (
    <div className="relative">
      {/* Date card */}
      <div className="relative overflow-hidden rounded-3xl border border-brand-lapis/15 bg-brand-paper px-8 py-10 shadow-[0_1px_0_rgba(0,0,0,0.02),0_24px_60px_-32px_rgba(23,42,110,0.4)]">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-brand-turquoise">
          {t("eyebrow")}
        </p>

        {/* The huge live day numeral */}
        <div className="flex min-h-[13rem] items-end gap-4">
          <span
            className="font-display text-brand-lapis tabular-nums leading-[0.8]"
            style={{ fontSize: "clamp(6rem, 15vw, 11rem)" }}
            aria-hidden={today === null}
          >
            {today ? toPersianDigitsForLocale(today.day, locale) : "‌"}
          </span>
          <div className="pb-3">
            <div
              className="font-display text-foreground leading-tight"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
            >
              {today ? jalaliMonthName(today.month, locale) : ""}
            </div>
            <div className="mt-1 text-xl text-muted-foreground">
              {today ? toPersianDigitsForLocale(today.year, locale) : ""}
            </div>
          </div>
        </div>

        {/* Saturday-start week strip. DOM order is Saturday-first; under RTL
            that renders Saturday rightmost with no explicit direction code —
            the same property the app's Calendar Week view relies on. */}
        <div className="mt-8 grid grid-cols-7 gap-1.5" role="list" aria-label="week">
          {(week ?? Array.from({ length: 7 }, () => null)).map((day, i) => {
            const isToday = day && today ? sameDay(day, today) : false;
            return (
              <div
                key={i}
                role="listitem"
                className={[
                  "flex flex-col items-center gap-1 rounded-xl py-2 transition-colors",
                  isToday
                    ? "bg-brand-lapis text-brand-paper"
                    : "bg-transparent text-muted-foreground",
                ].join(" ")}
              >
                <span className="text-[0.65rem] font-medium">{weekNames[i]}</span>
                <span
                  className={[
                    "text-sm tabular-nums",
                    isToday ? "font-semibold" : "text-foreground/70",
                  ].join(" ")}
                >
                  {day ? toPersianDigitsForLocale(day.day, locale) : "·"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
