"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { financeApi } from "@/lib/finance-api";
import { parseTomanInputToRial, tomanRawFromRial } from "@/lib/format-money";
import type { TransactionResponse, WalletResponse, CategoryResponse } from "@lifeos/contracts";

const transactionFormSchema = z.object({
  walletId: z.string().min(1, "required"),
  categoryId: z.string().min(1, "required"),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.string().min(1, "required"),
  occurredAt: z.string().min(1, "required"), // YYYY-MM-DD from <input type="date">
  note: z.string().max(500).optional(),
});
type TransactionFormValues = z.infer<typeof transactionFormSchema>;

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  wallets,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionResponse | null; // null = create mode
  wallets: WalletResponse[];
  categories: CategoryResponse[];
}) {
  const t = useTranslations("Transactions");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  // Regenerated each time the dialog actually opens (see the effect below)
  // rather than relying on Radix's own mount/unmount lifecycle — this
  // dialog component stays mounted across opens (its `open` prop just
  // toggles the underlying Radix state), matching the same pattern this
  // file's own form-reset effect already uses.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      walletId: "",
      categoryId: "",
      type: "EXPENSE",
      amount: "",
      occurredAt: todayDateInputValue(),
      note: "",
    },
  });

  const type = form.watch("type");
  const filteredCategories = categories.filter((cat) => cat.type === type);

  useEffect(() => {
    if (!open) return;
    setIdempotencyKey(crypto.randomUUID());
    form.reset(
      transaction
        ? {
            walletId: transaction.walletId,
            categoryId: transaction.categoryId,
            type: transaction.type,
            amount: tomanRawFromRial(transaction.amount),
            occurredAt: transaction.occurredAt.slice(0, 10),
            note: transaction.note ?? "",
          }
        : {
            walletId: wallets[0]?.id ?? "",
            categoryId: "",
            type: "EXPENSE",
            amount: "",
            occurredAt: todayDateInputValue(),
            note: "",
          },
    );
    // `wallets` deliberately excluded from this dependency array — same
    // reasoning as budget-form-dialog.tsx's identical effect: it's a prop
    // recomputed fresh on every parent render, and reacting to it would
    // reset the form (wiping in-progress input) whenever the wallets query
    // refetches in the background while this dialog is open.
  }, [open, transaction, form]);

  const mutation = useMutation({
    mutationFn: (values: TransactionFormValues) => {
      const input = {
        walletId: values.walletId,
        categoryId: values.categoryId,
        type: values.type,
        amount: parseTomanInputToRial(values.amount),
        currency: "IRR" as const,
        occurredAt: new Date(`${values.occurredAt}T00:00:00.000Z`).toISOString(),
        ...(values.note ? { note: values.note } : {}),
      };
      return transaction
        ? financeApi.updateTransaction(transaction.id, input, idempotencyKey)
        : financeApi.createTransaction(input, idempotencyKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success(c("save"));
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? t("editTransaction") : t("newTransaction")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("typeLabel")}</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === "EXPENSE" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => {
                        field.onChange("EXPENSE");
                        form.setValue("categoryId", "");
                      }}
                    >
                      {t("typeExpense")}
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "INCOME" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => {
                        field.onChange("INCOME");
                        form.setValue("categoryId", "");
                      }}
                    >
                      {t("typeIncome")}
                    </Button>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="walletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("walletLabel")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {wallets.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("categoryLabel")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("amountLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="occurredAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("dateLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("noteLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={500} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {c("save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
