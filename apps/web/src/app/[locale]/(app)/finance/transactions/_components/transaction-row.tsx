"use client";

import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/utils";
import { formatTomanFromRial } from "@/lib/format-money";
import { formatJalaliDate } from "@/lib/format-jalali";
import type { TransactionResponse } from "@lifeos/contracts";

export function TransactionRow({
  transaction,
  walletName,
  categoryName,
  onEdit,
  onDelete,
}: {
  transaction: TransactionResponse;
  walletName: string;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const locale = useLocale() as "fa" | "en";
  const c = useTranslations("Common");
  const isIncome = transaction.type === "INCOME";

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{categoryName}</span>
        <span className="text-xs text-muted-foreground">
          {walletName} · {formatJalaliDate(transaction.occurredAt, locale)}
          {transaction.note ? ` · ${transaction.note}` : ""}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("tabular-nums font-medium", isIncome ? "text-income" : "text-expense")}>
          {isIncome ? "+" : "−"}
          {formatTomanFromRial(transaction.amount, locale)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>{c("edit")}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              {c("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
