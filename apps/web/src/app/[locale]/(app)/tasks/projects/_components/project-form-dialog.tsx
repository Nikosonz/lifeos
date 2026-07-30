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
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { tasksApi } from "@/lib/tasks-api";
import type { ProjectResponse } from "@lifeos/contracts";

// Color isn't exposed here — same minimalism precedent as Finance's Wallet/
// Category forms, which also don't surface every optional contract field.
const projectFormSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
});
type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectResponse | null; // null = create mode
}) {
  const t = useTranslations("TaskProjects");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();
  const onMutationError = useMutationErrorHandler("tasks");

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (open) form.reset({ name: project?.name ?? "", description: project?.description ?? "" });
  }, [open, project, form]);

  const mutation = useMutation({
    mutationFn: (values: ProjectFormValues) => {
      const input = {
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
      };
      return project
        ? tasksApi.updateProject(project.id, { ...input, expectedVersion: project.version })
        : tasksApi.createProject(input);
    },
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
          <DialogTitle>{project ? t("editProject") : t("newProject")}</DialogTitle>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} maxLength={1000} />
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
