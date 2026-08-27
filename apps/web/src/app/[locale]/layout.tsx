import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DirectionProvider } from "@radix-ui/react-direction";
import { routing } from "@/i18n/routing";
import { vazirmatn } from "@/lib/fonts";
import { brandName } from "@/lib/brand";
import { SITE_URL, absoluteUrl } from "@/lib/site";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./_providers/query-provider";
import "../globals.css";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Site-wide document head. Until 2026-08-27 there was none at all: the live
 * https://maaleto.ir/fa returned 200 with an EMPTY title element, no
 * description and no og:* tags, so every link shared into Telegram — the
 * product's own distribution channel — rendered as a bare URL with no
 * title, no summary and no image.
 *
 * This is the DEFAULT layer. Each page still sets its own title and
 * description (see [locale]/page.tsx and privacy/page.tsx); the title
 * template wraps those with the brand, and the default covers any route
 * that sets nothing of its own.
 *
 * metadataBase is what turns the relative og:image path into the absolute
 * URL crawlers require — without it Next warns at build time and emits a
 * relative URL, which link-preview fetchers silently drop.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  // notFound() belongs in the layout body, not here: an invalid locale must
  // render a 404, and returning empty metadata simply lets it get there.
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "Landing" });
  const brand = brandName(locale);
  const ogImage = `/og-${locale === "fa" ? "fa" : "en"}.png`;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("metaTitle"), template: `%s — ${brand}` },
    description: t("metaDescription"),
    applicationName: brand,
    alternates: {
      canonical: absoluteUrl(locale),
      languages: {
        fa: absoluteUrl("fa"),
        en: absoluteUrl("en"),
        "x-default": absoluteUrl("fa"),
      },
    },
    openGraph: {
      type: "website",
      siteName: brand,
      locale: locale === "fa" ? "fa_IR" : "en_US",
      url: absoluteUrl(locale),
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: [{ url: ogImage, width: 1200, height: 630, alt: t("ogAlt") }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: [ogImage],
    },
    robots: { index: true, follow: true },
    // Declared explicitly rather than relying on the app/icon.* file
    // convention alone: this repo has no root app/layout.tsx (the [locale]
    // layout is what renders <html>), so automatic link injection for
    // root-level icon files is not something to assume works here. The
    // files still live at app/ so the routes they generate exist.
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const dir = locale === "fa" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={vazirmatn.variable}>
      <body className="font-sans antialiased">
        {/* DirectionProvider feeds `dir` into Radix's own positioning
            logic (Select/DropdownMenu/Dialog) — this is on top of, not
            instead of, the CSS logical-property fixes already applied to
            the generated shadcn components; the DOM `dir` attribute above
            alone isn't enough for Radix's Popper-based side/align math. */}
        <DirectionProvider dir={dir}>
          <NextIntlClientProvider>
            <QueryProvider>
              {children}
              <Toaster dir={dir} />
            </QueryProvider>
          </NextIntlClientProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
