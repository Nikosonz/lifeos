"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { financeApi } from "@/lib/finance-api";
import { formatTomanFromRial } from "@/lib/format-money";
import { formatJalaliMonthLabel, currentJalaliYearMonth } from "@/lib/format-jalali";
import { useJalaliMonth } from "@/lib/hooks/use-jalali-month";
import type { BudgetResponse } from "@lifeos/contracts";
import { BudgetFormDialog } from "./_components/budget-form-dialog";
import { ConfirmDeleteDialog } from "../../_components/confirm-delete-dialog";
import { PageHelp } from "../../_components/page-help";

export default function BudgetsPage() {
  const t = useTranslations("Budgets");
  const c = useTranslations("Common");
  const locale = useLocale() as "fa" | "en";
  const queryClient = useQueryClient();
  const month = useJalaliMonth(currentJalaliYearMonth());

  const [dialogBudget, setDialogBudget] = useState<BudgetResponse | null | undefined>(undefined);
  const [deletingBudget, setDeletingBudget] = useState<BudgetResponse | null>(null);

  const { data } = useQuery({
    queryKey: ["finance", "budgets", month.year, month.month],
    queryFn: () => financeApi.listBudgets(month.year, month.month),
  });
  const { data: categoriesData } = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: () => financeApi.listCategories(),
  });
  const expenseCategories = (categoriesData?.categories ?? []).filter(
    (cat) => cat.type === "EXPENSE",
  );
  // BudgetResponse only carries categoryId (unlike DashboardResponse's
  // nested budgets, which denormalize categoryName server-side) — resolved
  // client-side from the categories list, same pattern as the Transactions
  // page's wallet/category name resolution.
  const categoryNameById = new Map(
    (categoriesData?.categories ?? []).map((cat) => [cat.id, cat.name]),
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success(c("delete"));
      setDeletingBudget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="border-module-finance border-s-4 ps-3 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <PageHelp pageKey="budgets" />
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

      <Button size="sm" className="self-start" onClick={() => setDialogBudget(null)}>
        <Plus className="size-4" />
        {t("newBudget")}
      </Button>

      {data && data.budgets.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      {data && data.budgets.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("categoryLabel")}</TableHead>
              <TableHead>{t("limitLabel")}</TableHead>
              <TableHead>{t("spentLabel")}</TableHead>
              <TableHead>{t("remainingLabel")}</TableHead>
              <TableHead className="w-40" />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.budgets.map((budget) => {
              const limit = BigInt(budget.limitAmount);
              const spent = BigInt(budget.spent);
              const pct = limit > 0n ? Number((spent * 100n) / limit) : 0;
              return (
                <TableRow key={budget.id}>
                  <TableCell className="font-medium">
                    {categoryNameById.get(budget.categoryId) ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatTomanFromRial(budget.limitAmount, locale)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatTomanFromRial(budget.spent, locale)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatTomanFromRial(budget.remaining, locale)}
                  </TableCell>
                  <TableCell>
                    <Progress value={Math.min(pct, 100)} />
                  </TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setDialogBudget(budget)}>
                          {c("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeletingBudget(budget)}
                        >
                          {c("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <BudgetFormDialog
        open={dialogBudget !== undefined}
        onOpenChange={(open) => !open && setDialogBudget(undefined)}
        budget={dialogBudget ?? null}
        expenseCategories={expenseCategories}
        jalaliYear={month.year}
        jalaliMonth={month.month}
      />

      <ConfirmDeleteDialog
        open={deletingBudget !== null}
        onOpenChange={(open) => !open && setDeletingBudget(null)}
        onConfirm={() => deletingBudget && deleteMutation.mutate(deletingBudget.id)}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
