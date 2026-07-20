"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Wallet, Tags, ArrowLeftRight, PiggyBank } from "lucide-react";
import { cn } from "@/components/utils";
import { Badge } from "@/components/ui/badge";

const financeLinks = [
  { href: "/finance", key: "dashboard", icon: LayoutDashboard },
  { href: "/finance/wallets", key: "wallets", icon: Wallet },
  { href: "/finance/categories", key: "categories", icon: Tags },
  { href: "/finance/transactions", key: "transactions", icon: ArrowLeftRight },
  { href: "/finance/budgets", key: "budgets", icon: PiggyBank },
] as const;

// Tasks/Calendar/Notifications aren't built this pass (see the UI
// implementation plan's explicit scope cut) — shown as a visibly disabled,
// non-interactive row rather than a dead link, so the nav communicates the
// platform's real shape without 404ing anywhere.
const comingSoonKeys = ["tasks", "calendar", "notifications"] as const;

export function Nav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();

  return (
    <nav className="flex flex-col gap-1">
      {financeLinks.map(({ href, key, icon: Icon }) => {
        const fullHref = `/${locale}${href}`;
        const active = href === "/finance" ? pathname === fullHref : pathname.startsWith(fullHref);
        return (
          <Link
            key={href}
            href={fullHref}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(key)}
          </Link>
        );
      })}

      <div className="my-2 h-px bg-border" />

      {comingSoonKeys.map((key) => (
        <div
          key={key}
          aria-disabled="true"
          className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground/50"
        >
          <span>{t(key)}</span>
          <Badge variant="outline" className="text-[10px] text-muted-foreground/70">
            {t("comingSoon")}
          </Badge>
        </div>
      ))}
    </nav>
  );
}
