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
import type { CategoryResponse, CategoryType } from "@lifeos/contracts";

const categoryFormSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["INCOME", "EXPENSE"]),
});
type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryResponse | null; // null = create mode
}) {
  const t = useTranslations("Categories");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();
  const onMutationError = useMutationErrorHandler("finance");

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "", type: "EXPENSE" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? "",
        type: (category?.type ?? "EXPENSE") as CategoryType,
      });
    }
  }, [open, category, form]);

  const mutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      category
        ? financeApi.updateCategory(category.id, {
            name: values.name,
            expectedVersion: category.version,
          })
        : financeApi.createCategory({ name: values.name, type: values.type }),
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
          <DialogTitle>{category ? t("editCategory") : t("newCategory")}</DialogTitle>
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
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("typeLabel")}</FormLabel>
                  {/* Type is immutable after creation (CategoryUpdateInput
                      has no `type` field) — disabled, not hidden, in edit
                      mode so the user can still see what it is. */}
                  <Select value={field.value} onValueChange={field.onChange} disabled={!!category}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="EXPENSE">{t("typeExpense")}</SelectItem>
                      <SelectItem value="INCOME">{t("typeIncome")}</SelectItem>
                    </SelectContent>
                  </Select>
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
