"use client";

import { useEffect } from "react";
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
import type { BudgetResponse, CategoryResponse } from "@lifeos/contracts";

const budgetFormSchema = z.object({
  categoryId: z.string().min(1, "required"),
  limitAmount: z.string().min(1, "required"),
});
type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  expenseCategories,
  jalaliYear,
  jalaliMonth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetResponse | null; // null = create mode
  expenseCategories: CategoryResponse[];
  jalaliYear: number;
  jalaliMonth: number;
}) {
  const t = useTranslations("Budgets");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: { categoryId: "", limitAmount: "" },
  });

  // Deliberately NOT depending on `expenseCategories` here: it's a plain
  // `.filter()` result recomputed fresh on every parent render, so a new
  // reference lands whenever the categories query refetches in the
  // background (e.g. another finance mutation's broad `["finance"]`
  // invalidation) — including while this dialog is open. Reacting to that
  // would re-run form.reset() mid-edit and silently wipe whatever the user
  // had already typed. This effect should fire only when the dialog opens
  // or the edit target changes, not when the category list refreshes.
  useEffect(() => {
    if (!open) return;
    form.reset({
      categoryId: budget?.categoryId ?? expenseCategories[0]?.id ?? "",
      limitAmount: budget ? tomanRawFromRial(budget.limitAmount) : "",
    });
  }, [open, budget, form]);

  const mutation = useMutation({
    mutationFn: (values: BudgetFormValues) => {
      const limitAmount = parseTomanInputToRial(values.limitAmount);
      // POST is an upsert keyed by (user, category, jalaliYear, jalaliMonth)
      // per budgetService.createOrUpdateBudget — picking a category that
      // already has a budget for this month is safe to resubmit as-is, no
      // special-case branching needed here.
      return budget
        ? financeApi.updateBudget(budget.id, { limitAmount })
        : financeApi.createBudget({
            categoryId: values.categoryId,
            jalaliYear,
            jalaliMonth,
            limitAmount,
            currency: "IRR",
          });
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
          <DialogTitle>{budget ? t("editBudget") : t("newBudget")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("categoryLabel")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!!budget}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {expenseCategories.map((cat) => (
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
              name="limitAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("limitLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" autoFocus />
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
