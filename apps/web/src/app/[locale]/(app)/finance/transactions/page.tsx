"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { financeApi } from "@/lib/finance-api";
import type { TransactionResponse } from "@lifeos/contracts";
import { TransactionFormDialog } from "./_components/transaction-form-dialog";
import { TransactionRow } from "./_components/transaction-row";
import { ConfirmDeleteDialog } from "../../_components/confirm-delete-dialog";

export default function TransactionsPage() {
  const t = useTranslations("Transactions");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  const [dialogTransaction, setDialogTransaction] = useState<
    TransactionResponse | null | undefined
  >(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionResponse | null>(null);

  const { data: walletsData } = useQuery({
    queryKey: ["finance", "wallets"],
    queryFn: () => financeApi.listWallets(),
  });
  const { data: categoriesData } = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: () => financeApi.listCategories(),
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery({
    queryKey: ["finance", "transactions"],
    queryFn: ({ pageParam }) =>
      financeApi.listTransactions(pageParam !== undefined ? { cursor: pageParam } : {}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success(c("delete"));
      setDeletingTransaction(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const walletsById = new Map(walletsData?.wallets.map((w) => [w.id, w.name]) ?? []);
  const categoriesById = new Map(categoriesData?.categories.map((cat) => [cat.id, cat.name]) ?? []);
  const transactions = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="border-module-finance border-s-4 ps-3 text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <Button size="sm" onClick={() => setDialogTransaction(null)}>
          <Plus className="size-4" />
          {t("newTransaction")}
        </Button>
      </div>

      {!isPending && transactions.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      <div className="flex flex-col gap-2">
        {transactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            walletName={walletsById.get(transaction.walletId) ?? "—"}
            categoryName={categoriesById.get(transaction.categoryId) ?? "—"}
            onEdit={() => setDialogTransaction(transaction)}
            onDelete={() => setDeletingTransaction(transaction)}
          />
        ))}
      </div>

      {hasNextPage && (
        <Button
          variant="outline"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="self-center"
        >
          {c("loadMore")}
        </Button>
      )}

      <TransactionFormDialog
        open={dialogTransaction !== undefined}
        onOpenChange={(open) => !open && setDialogTransaction(undefined)}
        transaction={dialogTransaction ?? null}
        wallets={walletsData?.wallets ?? []}
        categories={categoriesData?.categories ?? []}
      />

      <ConfirmDeleteDialog
        open={deletingTransaction !== null}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
        onConfirm={() => deletingTransaction && deleteMutation.mutate(deletingTransaction.id)}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
