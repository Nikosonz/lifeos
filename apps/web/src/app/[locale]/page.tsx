import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wallet, ListTodo, CalendarDays, Flame, BarChart3, Bell } from "lucide-react";
import type { LucideIcon } from "lucide-react";
// Lalezar is loaded only on this route (the landing is its sole consumer);
// per-subset unicode-range means the browser fetches only the arabic/latin
// glyphs it actually renders. Everywhere else --font-display falls through
// to Vazirmatn.
import "@fontsource/lalezar/400.css";
import { moduleColorClasses, type ModuleKey } from "@/lib/module-colors";
import { brandName } from "@/lib/brand";
import { RedirectIfAuthed } from "./_components/redirect-if-authed";
import { LandingToday } from "./_components/landing-today";

type Props = { params: Promise<{ locale: string }> };

// An 8-pointed star (two overlapped squares) — the girih motif of Persian
// tilework, reused as both the ambient hero backdrop and the proof-row
// bullet so the page has one recurring signature shape.
function StarBullet() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-brand-lapis"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="5" y="5" width="14" height="14" />
      <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
    </svg>
  );
}

function GirihBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[680px] overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.06]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="girih" width="112" height="112" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="var(--brand-lapis)" strokeWidth="1">
              <rect x="28" y="28" width="56" height="56" />
              <rect x="28" y="28" width="56" height="56" transform="rotate(45 56 56)" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#girih)" />
      </svg>
    </div>
  );
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Landing" });
  const otherLocale = locale === "fa" ? "en" : "fa";

  const modules: { key: ModuleKey; icon: LucideIcon; title: string; desc: string }[] = [
    { key: "finance", icon: Wallet, title: t("moduleFinance"), desc: t("moduleFinanceDesc") },
    { key: "tasks", icon: ListTodo, title: t("moduleTasks"), desc: t("moduleTasksDesc") },
    {
      key: "calendar",
      icon: CalendarDays,
      title: t("moduleCalendar"),
      desc: t("moduleCalendarDesc"),
    },
    { key: "habits", icon: Flame, title: t("moduleHabits"), desc: t("moduleHabitsDesc") },
    { key: "reports", icon: BarChart3, title: t("moduleReports"), desc: t("moduleReportsDesc") },
    {
      key: "notifications",
      icon: Bell,
      title: t("moduleNotifications"),
      desc: t("moduleNotificationsDesc"),
    },
  ];

  const proofs = [t("proofJalali"), t("proofToman"), t("proofSaturday")];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-brand-paper text-foreground">
      <RedirectIfAuthed />
      <GirihBackground />

      {/* Top bar */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl leading-none text-brand-lapis">
          {brandName(locale)}
        </span>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href={`/${otherLocale}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("footerLocale")}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="font-medium text-foreground transition-colors hover:text-brand-lapis"
          >
            {t("signIn")}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-8 sm:pt-14">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="motion-safe:animate-[landing-rise_0.7s_ease-out_both]">
            <h1
              className="font-display leading-[1.05] text-foreground"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4.25rem)" }}
            >
              {t("title")}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {t("subtitle")}
            </p>
            <div className="mt-9">
              <Link
                href={`/${locale}/login`}
                className="inline-flex items-center justify-center rounded-full bg-brand-lapis px-7 py-3.5 text-base font-semibold text-brand-paper shadow-lg shadow-brand-lapis/25 transition-colors hover:bg-brand-lapis/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lapis"
              >
                {t("ctaPrimary")}
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">{t("weekNote")}</p>
          </div>

          <div className="motion-safe:animate-[landing-rise_0.7s_ease-out_0.1s_both]">
            <LandingToday />
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl sm:text-4xl">{t("modulesTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("modulesSubtitle")}</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const c = moduleColorClasses(m.key);
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.chip}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{m.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Proof — three parallel claims, not a sequence: no numbering */}
      <section className="relative border-y border-brand-lapis/10 bg-white/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-3">
          {proofs.map((p, i) => (
            <div key={i} className="flex gap-3">
              <StarBullet />
              <p className="text-sm leading-relaxed text-foreground/80">{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-10">
        <p className="text-sm text-muted-foreground">{t("footerApi")}</p>
        <Link
          href={`/${locale}/privacy`}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          {t("footerPrivacy")}
        </Link>
      </footer>
    </main>
  );
}
