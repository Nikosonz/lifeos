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
import { tasksApi } from "@/lib/tasks-api";
import type { LabelResponse } from "@lifeos/contracts";

const labelFormSchema = z.object({
  name: z.string().min(1).max(50),
});
type LabelFormValues = z.infer<typeof labelFormSchema>;

export function LabelFormDialog({
  open,
  onOpenChange,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: LabelResponse | null; // null = create mode
}) {
  const t = useTranslations("TaskLabels");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();
  const onMutationError = useMutationErrorHandler("tasks");

  const form = useForm<LabelFormValues>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (open) form.reset({ name: label?.name ?? "" });
  }, [open, label, form]);

  const mutation = useMutation({
    mutationFn: (values: LabelFormValues) =>
      label
        ? tasksApi.updateLabel(label.id, { name: values.name, expectedVersion: label.version })
        : tasksApi.createLabel({ name: values.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(c("save"));
      onOpenChange(false);
    },
    onError: onMutationError,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label ? t("editLabel") : t("newLabel")}</DialogTitle>
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
