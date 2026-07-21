"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { reportsApi } from "@/lib/reports-api";
import { formatTomanFromRial, toPersianDigits } from "@/lib/format-money";
import { formatJalaliMonthLabel, currentJalaliYearMonth } from "@/lib/format-jalali";
import { useJalaliMonth } from "@/lib/hooks/use-jalali-month";
import { PageHelp } from "../_components/page-help";

export default function ReportsPage() {
  const t = useTranslations("Reports");
  const c = useTranslations("Common");
  const locale = useLocale() as "fa" | "en";
  const month = useJalaliMonth(currentJalaliYearMonth());

  const { data, isPending, isError } = useQuery({
    queryKey: ["reports", "dashboard", month.year, month.month],
    queryFn: () => reportsApi.getDashboard({ jalaliYear: month.year, jalaliMonth: month.month }),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="border-module-reports border-s-4 ps-3 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <PageHelp pageKey="reports" />
        </div>
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
                {t("financeHeading")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("totalBalance")}</span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatTomanFromRial(data.finance.totalBalance, locale)}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("budgetsHeading")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {data.finance.budgets.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("emptyBudgets")}</p>
              )}
              {data.finance.budgets.map((b) => {
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("tasksHeading")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-8">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t("tasksCompleted")}</span>
                <span className="text-2xl font-semibold tabular-nums">
                  {locale === "fa"
                    ? toPersianDigits(String(data.tasks.completed))
                    : data.tasks.completed}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t("tasksCreated")}</span>
                <span className="text-2xl font-semibold tabular-nums">
                  {locale === "fa"
                    ? toPersianDigits(String(data.tasks.created))
                    : data.tasks.created}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
