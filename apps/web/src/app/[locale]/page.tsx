import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Wallet,
  ListTodo,
  CalendarDays,
  Flame,
  BarChart3,
  Bell,
  Monitor,
  Smartphone,
  Plug,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
// Lalezar is loaded only on this route (the landing is its sole consumer);
// per-subset unicode-range means the browser fetches only the arabic/latin
// glyphs it actually renders. Everywhere else --font-display falls through
// to Vazirmatn.
import "@fontsource/lalezar/400.css";
import { moduleColorClasses, type ModuleKey } from "@/lib/module-colors";
import { brandName } from "@/lib/brand";
import { SITE_URL, absoluteUrl, CONTACT_EMAIL } from "@/lib/site";
import { RedirectIfAuthed } from "./_components/redirect-if-authed";
import { LandingToday } from "./_components/landing-today";
import {
  BudgetDemo,
  TomanDemo,
  WeekDemo,
  FinanceMini,
  TasksMini,
  CalendarMini,
  HabitsMini,
  ReportsMini,
  NotificationsMini,
} from "./_components/landing-demos";

type Props = { params: Promise<{ locale: string }> };

/**
 * THE MARKETING SURFACE. Everything on this page has to be true of the
 * product as deployed today, not as designed — see CLAUDE.md. The claims
 * that are deliberately absent are as considered as the ones present:
 *
 *   - **No phone sign-up.** MockSmsProvider fails closed in production, so
 *     POST /api/v1/auth/request-otp with a phone is a 400. The CTA says
 *     email, and `phoneSoon` says the other channel is not live. This page
 *     previously advertised «شروع با شماره موبایل» — every visitor who
 *     clicked it hit a dead end.
 *   - **No Android download.** The app is real and at parity, but there is
 *     no store listing and no hosted APK, so it is named, not linked.
 *   - **No dark mode, no offline.** Both are deliberate deferrals (mobile
 *     has dark mode, web does not; offline is ADR-0002). Neither appears.
 *
 * The demos are labelled samples and render no real data — see
 * _components/landing-demos.tsx.
 */

/**
 * Page-level head only. The [locale] layout already owns metadataBase, the
 * title template, openGraph, twitter, icons, canonical and hreflang.
 *
 * Nothing else belongs here. Next replaces these objects wholesale rather
 * than deep-merging them, so re-declaring `alternates` to set one field
 * risks dropping the layout's `languages` (both hreflang tags), and
 * re-declaring `openGraph` risks dropping the og:image. The layout already
 * sets the correct per-locale value for every one of them.
 *
 * When checking any of this in the served HTML, grep case-insensitively:
 * React 19 emits the attribute as `hrefLang`, not `hreflang`. Both are
 * valid — HTML attribute names are case-insensitive — but a case-sensitive
 * grep reports zero tags on a page that has three.
 *
 * title.absolute (not title) because the layout's template appends the
 * brand, and metaTitle already contains it.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Landing" });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
  };
}

// An 8-pointed star (two overlapped squares) — the girih motif of Persian
// tilework, reused as the wordmark, the ambient hero backdrop and the
// proof-row bullet so the page has one recurring signature shape. It is
// also the Android launcher icon (mobile/assets/icon/), which is why the
// brand world is preserved rather than redrawn.
function GirihStar({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
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

// The one solid CTA, repeated at the top and the bottom. active:scale keeps
// a press feeling answered; only transform and background-color transition,
// never `all`.
function PrimaryCta({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-brand-lapis px-7 py-3.5 text-base font-semibold text-brand-paper shadow-lg shadow-brand-lapis/25 transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-brand-lapis/90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lapis"
    >
      {label}
    </Link>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-3xl sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Landing" });
  const otherLocale = locale === "fa" ? "en" : "fa";
  const loginHref = `/${locale}/login`;

  const modules: {
    key: ModuleKey;
    icon: LucideIcon;
    title: string;
    desc: string;
    demo: React.ReactNode;
  }[] = [
    {
      key: "finance",
      icon: Wallet,
      title: t("moduleFinance"),
      desc: t("moduleFinanceDesc"),
      demo: <FinanceMini locale={locale} />,
    },
    {
      key: "tasks",
      icon: ListTodo,
      title: t("moduleTasks"),
      desc: t("moduleTasksDesc"),
      demo: <TasksMini locale={locale} />,
    },
    {
      key: "calendar",
      icon: CalendarDays,
      title: t("moduleCalendar"),
      desc: t("moduleCalendarDesc"),
      demo: <CalendarMini locale={locale} />,
    },
    {
      key: "habits",
      icon: Flame,
      title: t("moduleHabits"),
      desc: t("moduleHabitsDesc"),
      demo: <HabitsMini locale={locale} />,
    },
    {
      key: "reports",
      icon: BarChart3,
      title: t("moduleReports"),
      desc: t("moduleReportsDesc"),
      demo: <ReportsMini locale={locale} />,
    },
    {
      key: "notifications",
      icon: Bell,
      title: t("moduleNotifications"),
      desc: t("moduleNotificationsDesc"),
      demo: <NotificationsMini locale={locale} />,
    },
  ];

  const clients: { icon: LucideIcon; title: string; desc: string; badge?: string }[] = [
    { icon: Monitor, title: t("clientWeb"), desc: t("clientWebDesc") },
    {
      icon: Smartphone,
      title: t("clientAndroid"),
      desc: t("clientAndroidDesc"),
      badge: t("clientAndroidBadge"),
    },
    { icon: Plug, title: t("clientApi"), desc: t("clientApiDesc") },
  ];

  const privacyPoints = [
    t("privacyAnalytics"),
    t("privacyPermissions"),
    t("privacyNoSale"),
    t("privacyPasswordless"),
    t("privacyDevices"),
    t("privacyDelete"),
  ];

  const faqs = [
    { q: t("faqFreeQ"), a: t("faqFreeA") },
    { q: t("faqPhoneQ"), a: t("faqPhoneA") },
    { q: t("faqAndroidQ"), a: t("faqAndroidA") },
    { q: t("faqOfflineQ"), a: t("faqOfflineA") },
    { q: t("faqCalendarQ"), a: t("faqCalendarA") },
    { q: t("faqDeleteQ"), a: t("faqDeleteA") },
  ];

  // Two nodes rather than a @graph: the app itself, and the site (so a
  // search engine can attribute the name). Every value is one the page
  // already states — no schema-only claims, which is what makes structured
  // data a liability rather than an asset.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: brandName(locale),
        inLanguage: locale === "fa" ? "fa-IR" : "en",
        description: t("metaDescription"),
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: brandName(locale),
        url: absoluteUrl(locale),
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web, Android",
        inLanguage: ["fa-IR", "en"],
        description: t("metaDescription"),
        // Free, and stated as such on the page itself.
        offers: { "@type": "Offer", price: "0", priceCurrency: "IRR" },
        privacyPolicy: absoluteUrl(locale, "/privacy"),
      },
    ],
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-brand-paper text-foreground">
      <RedirectIfAuthed />
      <GirihBackground />

      <script
        type="application/ld+json"
        // Serialized from an object literal built above — no user input
        // reaches it, so there is nothing to escape beyond the closing tag,
        // which JSON.stringify cannot emit from these values.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:start-4 focus:z-[60] focus:rounded-full focus:bg-brand-lapis focus:px-4 focus:py-2 focus:text-sm focus:text-brand-paper"
      >
        {t("skipToContent")}
      </a>

      {/* Top bar — sticky so the one CTA stays reachable on a long page.
          backdrop-blur + a translucent paper fill, no JS. */}
      <header className="sticky top-0 z-50 border-b border-brand-lapis/5 bg-brand-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <GirihStar className="h-6 w-6 text-brand-lapis" />
            <span className="font-display text-2xl leading-none text-brand-lapis">
              {brandName(locale)}
            </span>
          </Link>

          <nav className="flex items-center gap-5 text-sm">
            <a
              href="#features"
              className="hidden text-muted-foreground transition-colors duration-150 hover:text-foreground sm:inline"
            >
              {t("navFeatures")}
            </a>
            <a
              href="#privacy"
              className="hidden text-muted-foreground transition-colors duration-150 hover:text-foreground sm:inline"
            >
              {t("navPrivacy")}
            </a>
            <a
              href="#faq"
              className="hidden text-muted-foreground transition-colors duration-150 hover:text-foreground sm:inline"
            >
              {t("navFaq")}
            </a>
            <Link
              href={`/${otherLocale}`}
              className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {t("footerLocale")}
            </Link>
            <Link
              href={loginHref}
              className="font-medium text-foreground transition-colors duration-150 hover:text-brand-lapis"
            >
              {t("signIn")}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="motion-safe:animate-[landing-rise_0.6s_var(--ease-out)_both]">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-turquoise/30 bg-brand-turquoise/10 px-3 py-1 text-xs font-medium text-brand-turquoise-ink">
                <GirihStar className="h-3.5 w-3.5" />
                {t("badge")}
              </span>

              <h1
                className="mt-5 font-display leading-[1.05] text-foreground"
                style={{ fontSize: "clamp(2.5rem, 6vw, 4.25rem)" }}
              >
                {t("title")}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {t("subtitle")}
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <PrimaryCta href={loginHref} label={t("ctaPrimary")} />
                <a
                  href="#features"
                  className="inline-flex items-center justify-center rounded-full border border-brand-lapis/25 px-6 py-3.5 text-base font-medium text-brand-lapis transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-brand-lapis/5 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-lapis"
                >
                  {t("ctaSecondary")}
                </a>
              </div>

              <p className="mt-5 text-sm text-muted-foreground">{t("ctaNote")}</p>
              <p className="mt-1.5 text-sm text-muted-foreground/80">{t("phoneSoon")}</p>
            </div>

            <div className="motion-safe:animate-[landing-rise_0.6s_var(--ease-out)_0.1s_both]">
              <LandingToday />
            </div>
          </div>
        </section>

        {/* Proof — three parallel claims, each shown rather than asserted.
            Not a sequence, so no numbering. */}
        <section className="relative border-y border-brand-lapis/10 bg-white/40">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <SectionHeading title={t("proofTitle")} subtitle={t("proofSubtitle")} />

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className="flex flex-col gap-4">
                <BudgetDemo locale={locale} className="flex-1" />
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <GirihStar className="h-4 w-4 shrink-0 text-brand-lapis" />
                    {t("proofJalaliTitle")}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
                    {t("proofJalali")}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <TomanDemo locale={locale} className="flex-1" />
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <GirihStar className="h-4 w-4 shrink-0 text-brand-lapis" />
                    {t("proofTomanTitle")}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
                    {t("proofToman")}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <WeekDemo locale={locale} className="flex-1" />
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <GirihStar className="h-4 w-4 shrink-0 text-brand-lapis" />
                    {t("proofSaturdayTitle")}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
                    {t("weekNote")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Modules */}
        <section id="features" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <SectionHeading title={t("modulesTitle")} subtitle={t("modulesSubtitle")} />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => {
              const c = moduleColorClasses(m.key);
              const Icon = m.icon;
              return (
                <div
                  key={m.key}
                  className="flex flex-col rounded-2xl border border-border bg-card p-6 transition-[box-shadow,transform] duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.chip}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{m.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
                  <div className="mt-5 border-t border-border pt-5">{m.demo}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* One core, every client */}
        <section className="relative border-y border-brand-lapis/10 bg-white/40">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <SectionHeading title={t("clientsTitle")} />
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              {t("clientsBody")}
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {clients.map((client) => {
                const Icon = client.icon;
                return (
                  <div key={client.title} className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between gap-3">
                      <Icon className="h-5 w-5 text-brand-lapis" aria-hidden />
                      {client.badge && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                          {client.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{client.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {client.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <SectionHeading title={t("privacyTitle")} subtitle={t("privacySubtitle")} />

          <ul className="mt-10 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {privacyPoints.map((point) => (
              <li key={point} className="flex gap-3">
                <GirihStar className="mt-0.5 h-4 w-4 shrink-0 text-brand-lapis" />
                <span className="text-sm leading-relaxed text-foreground/85">{point}</span>
              </li>
            ))}
          </ul>

          <Link
            href={`/${locale}/privacy`}
            className="mt-8 inline-block text-sm font-medium text-brand-turquoise-ink underline underline-offset-4 transition-colors duration-150 hover:text-brand-lapis"
          >
            {t("privacyLink")}
          </Link>
        </section>

        {/* Price */}
        <section className="relative border-y border-brand-lapis/10 bg-white/40">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
            <h2 className="font-display text-3xl sm:text-4xl">{t("priceTitle")}</h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
              {t("priceBody")}
            </p>
          </div>
        </section>

        {/* FAQ — <details>, so it costs no JavaScript and works before
            hydration and with it disabled. */}
        <section id="faq" className="relative mx-auto max-w-3xl px-6 py-16 sm:py-24">
          <SectionHeading title={t("faqTitle")} />

          <div className="mt-8 divide-y divide-border border-y border-border">
            {faqs.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-start font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-3 pe-8 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative mx-auto max-w-3xl px-6 pb-20 text-center">
          <h2 className="font-display text-3xl sm:text-4xl">{t("finalTitle")}</h2>
          <p className="mt-4 text-muted-foreground">{t("finalBody")}</p>
          <div className="mt-8 flex justify-center">
            <PrimaryCta href={loginHref} label={t("ctaPrimary")} />
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{t("ctaNote")}</p>
        </section>
      </main>

      <footer className="relative border-t border-brand-lapis/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-10 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <GirihStar className="h-4 w-4 text-brand-lapis" />
            <span className="font-display text-lg leading-none text-brand-lapis">
              {brandName(locale)}
            </span>
          </span>
          <p>{t("footerApi")}</p>
          <Link
            href={`/${locale}/privacy`}
            className="underline underline-offset-2 transition-colors duration-150 hover:text-foreground"
          >
            {t("footerPrivacy")}
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline underline-offset-2 transition-colors duration-150 hover:text-foreground"
            dir="ltr"
          >
            {CONTACT_EMAIL}
          </a>
          <Link
            href={`/${otherLocale}`}
            className="transition-colors duration-150 hover:text-foreground"
          >
            {t("footerLocale")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
