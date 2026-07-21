"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { financeApi } from "@/lib/finance-api";
import { formatTomanFromRial } from "@/lib/format-money";
import { formatJalaliMonthLabel, currentJalaliYearMonth } from "@/lib/format-jalali";
import { useJalaliMonth } from "@/lib/hooks/use-jalali-month";

export default function FinanceDashboardPage() {
  const t = useTranslations("FinanceDashboard");
  const c = useTranslations("Common");
  const locale = useLocale() as "fa" | "en";
  const month = useJalaliMonth(currentJalaliYearMonth());

  const { data, isPending, isError } = useQuery({
    queryKey: ["finance", "dashboard", month.year, month.month],
    queryFn: () => financeApi.getDashboard({ jalaliYear: month.year, jalaliMonth: month.month }),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="border-module-finance border-s-4 ps-3 text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={month.prev} aria-label={t("prevMonth")}>
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">
            {formatJalaliMonthLabel(month.year, month.month, locale)}
          </span>
          <Button variant="outline" size="icon-sm" onClick={month.next} aria-label={t("nextMonth")}>
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">{c("loading")}</p>}
      {isError && <p className="text-sm text-destructive">{c("unexpectedError")}</p>}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalBalance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">
                {formatTomanFromRial(data.totalBalance, locale)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("walletsHeading")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.wallets.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              {data.wallets.map((w) => (
                <div key={w.walletId} className="flex items-center justify-between text-sm">
                  <span>{w.name}</span>
                  <span className="font-medium tabular-nums">
                    {formatTomanFromRial(w.balance, locale)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("spendingHeading")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.spendingByCategory.length === 0 && (
                <p className="text-sm text-muted-foreground">—</p>
              )}
              {data.spendingByCategory.map((s) => (
                <div key={s.categoryId} className="flex items-center justify-between text-sm">
                  <span>{s.categoryName}</span>
                  <span className="font-medium tabular-nums">
                    {formatTomanFromRial(s.spent, locale)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("budgetsHeading")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {data.budgets.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              {data.budgets.map((b) => {
                const limit = BigInt(b.limitAmount);
                const spent = BigInt(b.spent);
                const pct = limit > 0n ? Number((spent * 100n) / limit) : 0;
                return (
                  <div key={b.categoryId} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>{b.categoryName}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatTomanFromRial(b.spent, locale)} /{" "}
                        {formatTomanFromRial(b.limitAmount, locale)}
                      </span>
                    </div>
                    <Progress value={Math.min(pct, 100)} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
