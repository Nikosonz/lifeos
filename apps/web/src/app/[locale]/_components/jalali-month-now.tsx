"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { currentJalaliDate, jalaliMonthName, toPersianDigitsForLocale } from "@/lib/format-jalali";

/**
 * The current Jalali month and year, e.g. «مرداد ۱۴۰۵».
 *
 * Client-only for the same reason <LandingToday /> is: anything derived
 * from `new Date()` during a server render is correct only until that
 * response is reused. The landing reads no per-request data, so it is a
 * prime candidate for prerendering or an edge cache, and a baked-in month
 * would leave a budget card whose whole claim is "the Jalali month is the
 * boundary" showing last quarter's month.
 *
 * Mount-gated (not rendered on the first client pass) so there is no
 * hydration mismatch, and the space it occupies is reserved by the caller's
 * line box, so filling it shifts nothing.
 */
export function JalaliMonthNow() {
  const locale = useLocale() as "fa" | "en";
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const today = currentJalaliDate();
    setLabel(
      `${jalaliMonthName(today.month, locale)} ${toPersianDigitsForLocale(today.year, locale)}`,
    );
  }, [locale]);

  // A zero-width non-joiner rather than an empty string: keeps the line box
  // at its full height before the label arrives.
  return <span className="tabular-nums">{label ?? "‌"}</span>;
}
