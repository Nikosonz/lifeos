import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { DirectionProvider } from "@radix-ui/react-direction";
import { routing } from "@/i18n/routing";
import { vazirmatn } from "@/lib/fonts";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./_providers/query-provider";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
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
