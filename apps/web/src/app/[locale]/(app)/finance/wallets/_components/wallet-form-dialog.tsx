"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMutationErrorHandler } from "@/lib/hooks/use-mutation-error-handler";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { financeApi } from "@/lib/finance-api";
import type { WalletResponse } from "@lifeos/contracts";

// Only `name` is a form field — currency is fixed to IRR (the only
// currency this contract accepts today, see MoneyAmountInput's comment in
// packages/contracts) so there's nothing for the user to pick.
const walletFormSchema = z.object({
  name: z.string().min(1).max(100),
});
type WalletFormValues = z.infer<typeof walletFormSchema>;

export function WalletFormDialog({
  open,
  onOpenChange,
  wallet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletResponse | null; // null = create mode
}) {
  const t = useTranslations("Wallets");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();
  const onMutationError = useMutationErrorHandler("finance");

  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (open) form.reset({ name: wallet?.name ?? "" });
  }, [open, wallet, form]);

  const mutation = useMutation({
    mutationFn: (values: WalletFormValues) =>
      wallet
        ? financeApi.updateWallet(wallet.id, { name: values.name, expectedVersion: wallet.version })
        : financeApi.createWallet({ name: values.name, currency: "IRR" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success(c("save"));
      onOpenChange(false);
    },
    onError: onMutationError,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{wallet ? t("editWallet") : t("newWallet")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("nameLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus />
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
