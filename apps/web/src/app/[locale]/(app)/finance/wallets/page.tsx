"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMutationErrorHandler } from "@/lib/hooks/use-mutation-error-handler";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { WalletResponse } from "@lifeos/contracts";
import { WalletFormDialog } from "./_components/wallet-form-dialog";
import { ConfirmDeleteDialog } from "../../_components/confirm-delete-dialog";
import { PageHelp } from "../../_components/page-help";

export default function WalletsPage() {
  const t = useTranslations("Wallets");
  const c = useTranslations("Common");
  const locale = useLocale() as "fa" | "en";
  const queryClient = useQueryClient();
  const onMutationError = useMutationErrorHandler("finance");

  const [dialogWallet, setDialogWallet] = useState<WalletResponse | null | undefined>(undefined);
  const [deletingWallet, setDeletingWallet] = useState<WalletResponse | null>(null);

  const { data } = useQuery({
    queryKey: ["finance", "wallets"],
    queryFn: () => financeApi.listWallets(),
  });

  const deleteMutation = useMutation({
    mutationFn: (entity: WalletResponse) => financeApi.deleteWallet(entity.id, entity.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success(c("delete"));
      setDeletingWallet(null);
    },
    onError: onMutationError,
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="border-module-finance border-s-4 ps-3 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <PageHelp pageKey="wallets" />
        </div>
        <Button size="sm" onClick={() => setDialogWallet(null)}>
          <Plus className="size-4" />
          {t("newWallet")}
        </Button>
      </div>

      {data && data.wallets.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      {data && data.wallets.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("nameLabel")}</TableHead>
              <TableHead>{t("balanceLabel")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.wallets.map((wallet) => (
              <TableRow key={wallet.id}>
                <TableCell className="font-medium">{wallet.name}</TableCell>
                <TableCell className="tabular-nums">
                  {formatTomanFromRial(wallet.balance, locale)}
                </TableCell>
                <TableCell className="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDialogWallet(wallet)}>
                        {c("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeletingWallet(wallet)}
                      >
                        {c("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <WalletFormDialog
        open={dialogWallet !== undefined}
        onOpenChange={(open) => !open && setDialogWallet(undefined)}
        wallet={dialogWallet ?? null}
      />

      <ConfirmDeleteDialog
        open={deletingWallet !== null}
        onOpenChange={(open) => !open && setDeletingWallet(null)}
        onConfirm={() => deletingWallet && deleteMutation.mutate(deletingWallet)}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
