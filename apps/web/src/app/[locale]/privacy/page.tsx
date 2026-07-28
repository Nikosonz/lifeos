import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { brandName } from "@/lib/brand";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return { title: `${t("title")} — ${brandName(locale)}` };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

// A plain Server Component, unlike every authenticated page in this app:
// there is nothing user-specific here, so none of the localStorage/
// client-render constraints documented in CLAUDE.md's Web UI Architecture
// apply. It must also stay reachable while logged out — Cafe Bazaar and
// Myket both require a publicly-fetchable policy URL for a store listing,
// and the mobile Settings screen links straight here.
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });

  const collected = [
    t("collectIdentifier"),
    t("collectName"),
    t("collectContent"),
    t("collectDevice"),
  ];
  const notCollected = [t("noCollectAnalytics"), t("noCollectPermissions"), t("noCollectSale")];
  const rights = [t("rightsAccess"), t("rightsDevices"), t("rightsDelete")];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="border-brand-lapis border-s-4 ps-3 text-2xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">{t("lastUpdated")}</p>

      <div className="mt-8 flex flex-col gap-8">
        <p className="text-sm leading-relaxed">{t("intro")}</p>

        <Section title={t("collectTitle")}>
          <ul className="flex list-disc flex-col gap-2 ps-5 text-sm leading-relaxed">
            {collected.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>

        <Section title={t("noCollectTitle")}>
          <ul className="flex list-disc flex-col gap-2 ps-5 text-sm leading-relaxed">
            {notCollected.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>

        <Section title={t("useTitle")}>
          <p className="text-sm leading-relaxed">{t("useBody")}</p>
        </Section>

        <Section title={t("storageTitle")}>
          <p className="text-sm leading-relaxed">{t("storageBody")}</p>
        </Section>

        <Section title={t("rightsTitle")}>
          <ul className="flex list-disc flex-col gap-2 ps-5 text-sm leading-relaxed">
            {rights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>

        <Section title={t("contactTitle")}>
          <p className="text-sm leading-relaxed">
            {t("contactBody")}{" "}
            <a href={`mailto:${t("contactEmail")}`} className="underline underline-offset-2">
              {t("contactEmail")}
            </a>
          </p>
        </Section>

        <Link href={`/${locale}`} className="text-sm underline underline-offset-2">
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
