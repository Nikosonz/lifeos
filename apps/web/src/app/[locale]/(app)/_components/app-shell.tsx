"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth-api";
import { clearTokens } from "@/lib/token-store";
import { Nav } from "./nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleLogout() {
    await logout();
    clearTokens();
    router.replace(`/${locale}/login`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label={t("menuToggle")}
          >
            {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
          <span className="text-lg font-semibold tracking-tight">LifeOS</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} data-tour="logout">
          <LogOut className="size-4" />
          {t("logout")}
        </Button>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-e p-4 sm:block" data-tour="nav">
          <Nav />
        </aside>

        {mobileNavOpen && (
          <div className="absolute inset-x-0 top-[57px] z-40 border-b bg-background p-4 sm:hidden">
            <Nav />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
