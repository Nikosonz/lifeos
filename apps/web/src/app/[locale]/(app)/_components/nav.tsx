"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Wallet,
  Tags,
  ArrowLeftRight,
  PiggyBank,
  ListTodo,
  FolderKanban,
  Tag,
  CalendarDays,
  Bell,
  BarChart3,
} from "lucide-react";
import { cn } from "@/components/utils";
import { moduleColorClasses, type ModuleKey } from "@/lib/module-colors";

const links = [
  { href: "/finance", key: "dashboard", icon: LayoutDashboard, module: "finance" },
  { href: "/finance/wallets", key: "wallets", icon: Wallet, module: "finance" },
  { href: "/finance/categories", key: "categories", icon: Tags, module: "finance" },
  { href: "/finance/transactions", key: "transactions", icon: ArrowLeftRight, module: "finance" },
  { href: "/finance/budgets", key: "budgets", icon: PiggyBank, module: "finance" },
  { href: "/tasks", key: "tasks", icon: ListTodo, module: "tasks" },
  { href: "/tasks/projects", key: "projects", icon: FolderKanban, module: "tasks" },
  { href: "/tasks/labels", key: "labels", icon: Tag, module: "tasks" },
  { href: "/calendar", key: "calendar", icon: CalendarDays, module: "calendar" },
  { href: "/notifications", key: "notifications", icon: Bell, module: "notifications" },
  { href: "/reports", key: "reports", icon: BarChart3, module: "reports" },
] as const satisfies ReadonlyArray<{
  href: string;
  key: string;
  icon: typeof LayoutDashboard;
  module: ModuleKey;
}>;

// "Root" links (a module's own dashboard/list) need an exact-match active
// check — a startsWith check would also light up "/finance" while sitting
// on "/finance/wallets", and now that "/tasks" has real sub-routes
// ("/tasks/projects", "/tasks/labels") it has the exact same problem.
const exactMatchHrefs = new Set(["/finance", "/tasks", "/calendar", "/notifications", "/reports"]);

export function Nav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();

  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, key, icon: Icon, module }) => {
        const fullHref = `/${locale}${href}`;
        const active = exactMatchHrefs.has(href)
          ? pathname === fullHref
          : pathname.startsWith(fullHref);
        const colors = moduleColorClasses(module);
        return (
          <Link
            key={href}
            href={fullHref}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? cn(colors.activeBg, colors.icon)
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className={cn("size-4", !active && colors.icon)} />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
