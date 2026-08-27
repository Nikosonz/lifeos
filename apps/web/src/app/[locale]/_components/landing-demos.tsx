import { getTranslations } from "next-intl/server";
import { Flame, Bell, Check } from "lucide-react";
import { formatTomanFromRial, toPersianDigits } from "@/lib/format-money";
import { toPersianDigitsForLocale } from "@/lib/format-jalali";
import { JalaliMonthNow } from "./jalali-month-now";

/**
 * The landing's product demos: real product chrome, made-up numbers.
 *
 * WHY THESE ARE RENDERED RATHER THAN SCREENSHOTTED. The repo's 24 Playwright
 * screenshots are e2e artifacts — one wallet, one category, a negative
 * balance, a toast over the corner. They are honest and they make the
 * product look empty. Screenshots also go stale against a redesign, need
 * re-capturing per locale, and cost bytes on the critical path. Rendering
 * the same UI as markup is crisp at every DPI, flips correctly under RTL
 * with no second asset, translates with the rest of the page, and cannot
 * drift from the design tokens because it reads them.
 *
 * ALL SERVER COMPONENTS. Nothing here needs state or an event handler, so
 * none of it ships JavaScript. The single exception is <JalaliMonthNow />,
 * which is client-side for the same reason <LandingToday /> is: a
 * server-computed "current Jalali month" is only correct for as long as the
 * response is not reused. The landing has no per-request data, so it is a
 * prime candidate for prerendering or an edge cache — and the moment it is
 * cached, a baked-in month makes the budget card disprove the exact claim
 * it exists to make.
 *
 * EVERY BLOCK IS LABELLED «نمونه» / "Sample". These look like an account
 * because they are the account UI; a visitor must never be left thinking
 * they are reading real data or a real customer's finances.
 *
 * Amounts are Rial minor-unit strings run through formatTomanFromRial, the
 * same single conversion point the app uses — not hand-written digits. Same
 * for Persian numerals: toPersianDigits/toPersianDigitsForLocale, never a
 * literal ۸۲ in a string.
 */

type Loc = "fa" | "en";

/** The three proof-band demos; className carries the row's flex-1 stretch. */
type DemoProps = { locale: string; className?: string };

// Sample figures, in Rial minor units (see lib/format-money.ts). Chosen to
// be plausible for a household in Iran rather than round demo-ware numbers.
const BUDGET_SPENT_RIAL = "8200000"; // 820,000 Toman
const BUDGET_CAP_RIAL = "10000000"; // 1,000,000 Toman
const BUDGET_PERCENT = 82;
const WALLET_RIAL = "24500000"; // 2,450,000 Toman
const TX_COFFEE_RIAL = "850000"; // 85,000 Toman
const TX_SALARY_RIAL = "120000000"; // 12,000,000 Toman

function pct(n: number, loc: Loc): string {
  return loc === "fa" ? `${toPersianDigits(String(n))}٪` : `${n}%`;
}

/** «نمونه» / "Sample" — the honesty marker every demo block carries. */
async function SampleBadge({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Landing" });
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground">
      {t("demoBadge")}
    </span>
  );
}

/**
 * Shared frame. `role="img"` with a label is deliberate: a screen reader
 * should hear "a sample of the app's interface" and move on, not read out
 * fourteen invented numbers as though they meant something.
 */
async function DemoFrame({
  locale,
  title,
  children,
  className = "",
}: {
  locale: string;
  title?: string;
  children: React.ReactNode;
  // Explicitly | undefined: exactOptionalPropertyTypes is on, so a caller
  // forwarding an optional prop through would otherwise not typecheck.
  className?: string | undefined;
}) {
  const t = await getTranslations({ locale, namespace: "Landing" });
  return (
    <div
      role="img"
      aria-label={t("demoAria")}
      className={`rounded-2xl border border-border bg-card p-5 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <SampleBadge locale={locale} />
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proof band                                                          */
/* ------------------------------------------------------------------ */

/**
 * The Jalali month as a budget boundary — the product's central claim,
 * shown. The month name is live (see JalaliMonthNow) so the card is always
 * about the month the visitor is actually in.
 */
export async function BudgetDemo({ locale, className }: DemoProps) {
  const loc: Loc = locale === "fa" ? "fa" : "en";
  const t = await getTranslations({ locale, namespace: "Landing" });

  return (
    <DemoFrame locale={locale} title={t("moduleFinance")} className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{t("demoBudgetCategory")}</span>
        <span className="text-xs text-module-finance">
          <JalaliMonthNow />
        </span>
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-module-finance-subtle">
        {/* Logical inset so the bar fills from the reading edge in both
            directions — a left-anchored width would fill backwards in RTL. */}
        <div
          className="h-full rounded-full bg-module-finance"
          style={{ width: `${BUDGET_PERCENT}%` }}
        />
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {t("demoBudgetSpent")}{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatTomanFromRial(BUDGET_SPENT_RIAL, loc)}
          </span>{" "}
          {t("demoToman")}
        </span>
        <span className="tabular-nums text-muted-foreground">{pct(BUDGET_PERCENT, loc)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("demoBudgetLimit")}{" "}
        <span className="tabular-nums">{formatTomanFromRial(BUDGET_CAP_RIAL, loc)}</span>{" "}
        {t("demoToman")}
      </p>
    </DemoFrame>
  );
}

/** Toman, integer, grouped — two rows of the real transactions list. */
export async function TomanDemo({ locale, className }: DemoProps) {
  const loc: Loc = locale === "fa" ? "fa" : "en";
  const t = await getTranslations({ locale, namespace: "Landing" });

  const rows = [
    { label: t("demoTxSalary"), rial: TX_SALARY_RIAL, income: true },
    { label: t("demoTxCoffee"), rial: TX_COFFEE_RIAL, income: false },
  ];

  return (
    <DemoFrame locale={locale} title={t("demoWallet")} className={className}>
      <p className="text-2xl font-semibold tabular-nums text-foreground">
        {formatTomanFromRial(WALLET_RIAL, loc)}{" "}
        <span className="text-sm font-normal text-muted-foreground">{t("demoToman")}</span>
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="text-foreground">{row.label}</span>
            <span
              className={`tabular-nums ${row.income ? "text-income" : "text-expense"}`}
              // The sign is direction, not part of the number: force it to
              // sit with the digits instead of being reordered by the bidi
              // algorithm next to Persian text.
              dir="ltr"
            >
              {row.income ? "+" : "−"}
              {formatTomanFromRial(row.rial, loc)}
            </span>
          </li>
        ))}
      </ul>
    </DemoFrame>
  );
}

/**
 * Saturday-first week. DOM order is Saturday-first and RTL reverses it
 * visually with no direction code — the same property the app's Calendar
 * Week view relies on, which is why this is worth showing rather than
 * stating.
 */
export async function WeekDemo({ locale, className }: DemoProps) {
  const loc: Loc = locale === "fa" ? "fa" : "en";
  const t = await getTranslations({ locale, namespace: "Landing" });

  const names =
    loc === "fa" ? ["ش", "ی", "د", "س", "چ", "پ", "ج"] : ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"];
  const days = [12, 13, 14, 15, 16, 17, 18];
  const activeIndex = 3;

  return (
    <DemoFrame locale={locale} title={t("moduleCalendar")} className={className}>
      <div className="grid grid-cols-7 gap-1.5">
        {names.map((name, i) => (
          <div
            key={name}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 ${
              i === activeIndex ? "bg-brand-lapis text-brand-paper" : "text-muted-foreground"
            }`}
          >
            <span className="text-[0.65rem] font-medium">{name}</span>
            <span
              className={`text-sm tabular-nums ${
                i === activeIndex ? "font-semibold" : "text-foreground/70"
              }`}
            >
              {toPersianDigitsForLocale(days[i]!, loc)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("proofSaturday")}</p>
    </DemoFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Module micro-renders                                                */
/* ------------------------------------------------------------------ */
/* Small enough to sit inside a module card without competing with the
   copy. Each shows the one thing that module is actually for. */

export async function FinanceMini({ locale }: { locale: string }) {
  const loc: Loc = locale === "fa" ? "fa" : "en";
  const t = await getTranslations({ locale, namespace: "Landing" });
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{t("demoBudgetCategory")}</span>
        <span className="tabular-nums text-muted-foreground">{pct(BUDGET_PERCENT, loc)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-module-finance-subtle">
        <div className="h-full rounded-full bg-module-finance" style={{ width: "82%" }} />
      </div>
    </div>
  );
}

export async function TasksMini({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Landing" });
  return (
    <div aria-hidden className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="flex h-4 w-4 items-center justify-center rounded border border-module-tasks bg-module-tasks text-module-tasks-foreground">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        <span className="text-muted-foreground line-through">{t("demoTaskOne")}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded border border-border" />
        <span className="text-foreground">{t("demoTaskTwo")}</span>
        <span className="rounded-full bg-module-tasks-subtle px-1.5 py-0.5 text-[0.6rem] text-module-tasks">
          {t("demoTaskLabel")}
        </span>
      </div>
      <div className="flex items-center gap-2 ps-6">
        <span className="h-3 w-3 rounded-sm border border-border" />
        <span className="text-muted-foreground">{t("demoTaskSub")}</span>
      </div>
    </div>
  );
}

export async function CalendarMini({ locale }: { locale: string }) {
  const loc: Loc = locale === "fa" ? "fa" : "en";
  // A fixed 4×7 fragment of a month rather than a real one: with no month
  // label there is nothing to be stale, and a live grid would need a second
  // client island for a decoration.
  const cells = Array.from({ length: 21 }, (_, i) => i + 1);
  const eventDay = 9;
  const holidayDay = 13;
  return (
    <div aria-hidden className="grid grid-cols-7 gap-1">
      {cells.map((day) => (
        <div
          key={day}
          className={`flex h-5 items-center justify-center rounded text-[0.6rem] tabular-nums ${
            day === holidayDay
              ? "bg-expense/10 font-semibold text-expense"
              : day === eventDay
                ? "bg-module-calendar-subtle font-semibold text-module-calendar"
                : "text-muted-foreground"
          }`}
        >
          {toPersianDigitsForLocale(day, loc)}
        </div>
      ))}
    </div>
  );
}

export async function HabitsMini({ locale }: { locale: string }) {
  const loc: Loc = locale === "fa" ? "fa" : "en";
  const t = await getTranslations({ locale, namespace: "Landing" });
  const streak = 12;
  // Twelve filled days then two empty — a streak that is running, not a
  // perfect wall, which is what a real one looks like.
  const days = Array.from({ length: 14 }, (_, i) => i < streak);
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs">
        <Flame className="h-3.5 w-3.5 text-module-habits" />
        <span className="font-semibold text-foreground">
          {t("demoHabitStreak", { count: toPersianDigitsForLocale(streak, loc) })}
        </span>
      </div>
      <div className="flex gap-1">
        {days.map((filled, i) => (
          <span
            key={i}
            className={`h-4 w-2.5 rounded-sm ${
              filled ? "bg-module-habits" : "bg-module-habits-subtle"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export async function ReportsMini({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Landing" });
  const bars = [46, 72, 58, 88];
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">{t("demoReport")}</span>
      <div className="flex h-12 items-end gap-2">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-full rounded-t-sm bg-module-reports"
            style={{ height: `${h}%`, opacity: 0.45 + i * 0.18 }}
          />
        ))}
      </div>
    </div>
  );
}

export async function NotificationsMini({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Landing" });
  return (
    <div
      aria-hidden
      className="flex items-start gap-2 rounded-xl bg-module-notifications-subtle p-2.5"
    >
      <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-module-notifications-foreground" />
      <div className="flex flex-col gap-0.5">
        <span className="text-[0.7rem] leading-snug text-foreground">{t("demoNotif")}</span>
        <span className="text-[0.6rem] text-muted-foreground">{t("demoNotifTime")}</span>
      </div>
    </div>
  );
}
