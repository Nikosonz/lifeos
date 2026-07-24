"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
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
import { tasksApi } from "@/lib/tasks-api";
import { useResetFormOnOpen } from "@/lib/hooks/use-reset-form-on-open";
import { cn } from "@/components/utils";
import { TaskStatus, TaskPriority } from "@lifeos/contracts";
import type { TaskResponse, TaskCreateInput, TaskUpdateInput } from "@lifeos/contracts";
import { statusMessageKey, priorityMessageKey } from "./task-badges";

const NO_PROJECT = "__none__";

const taskFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus,
  priority: TaskPriority,
  projectId: z.string(), // NO_PROJECT sentinel or a real project id
  deadline: z.string(), // "" or YYYY-MM-DD from <input type="date">
  labelIds: z.array(z.string()),
});
type TaskFormValues = z.infer<typeof taskFormSchema>;

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskResponse | null; // null = create mode
}) {
  const t = useTranslations("Tasks");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ["tasks", "projects"],
    queryFn: () => tasksApi.listProjects(),
  });
  const { data: labelsData } = useQuery({
    queryKey: ["tasks", "labels"],
    queryFn: () => tasksApi.listLabels(),
  });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "TODO",
      priority: "MEDIUM",
      projectId: NO_PROJECT,
      deadline: "",
      labelIds: [],
    },
  });

  // projectsData/labelsData are deliberately never touched by this reset —
  // useResetFormOnOpen's signature has no slot for a derived list, so the
  // historical bug (an unrelated list refetch wiping in-progress input)
  // isn't representable here.
  useResetFormOnOpen(form, open, task, (t): TaskFormValues =>
    t
      ? {
          title: t.title,
          description: t.description ?? "",
          status: t.status,
          priority: t.priority,
          projectId: t.projectId ?? NO_PROJECT,
          deadline: t.deadline ? t.deadline.slice(0, 10) : "",
          labelIds: t.labelIds,
        }
      : {
          title: "",
          description: "",
          status: "TODO",
          priority: "MEDIUM",
          projectId: NO_PROJECT,
          deadline: "",
          labelIds: [],
        },
  );

  const mutation = useMutation({
    mutationFn: (values: TaskFormValues) => {
      const projectId = values.projectId === NO_PROJECT ? null : values.projectId;
      const deadline = values.deadline
        ? new Date(`${values.deadline}T00:00:00.000Z`).toISOString()
        : null;

      if (task) {
        const input: TaskUpdateInput = {
          title: values.title,
          description: values.description ? values.description : null,
          status: values.status,
          priority: values.priority,
          projectId,
          deadline,
          labelIds: values.labelIds,
        };
        return tasksApi.updateTask(task.id, input);
      }

      const input: TaskCreateInput = {
        title: values.title,
        ...(values.description ? { description: values.description } : {}),
        status: values.status,
        priority: values.priority,
        ...(projectId ? { projectId } : {}),
        ...(deadline ? { deadline } : {}),
        ...(values.labelIds.length > 0 ? { labelIds: values.labelIds } : {}),
      };
      return tasksApi.createTask(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(c("save"));
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const projects = projectsData?.projects ?? [];
  const labels = labelsData?.labels ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? t("editTask") : t("newTask")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("titleLabel")}</FormLabel>
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
                    <Textarea {...field} maxLength={2000} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("statusLabel")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TaskStatus.options.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(statusMessageKey(status))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("priorityLabel")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TaskPriority.options.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {t(priorityMessageKey(priority))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("projectLabel")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>{t("noProject")}</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("deadlineLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                </FormItem>
              )}
            />

            {labels.length > 0 && (
              <FormField
                control={form.control}
                name="labelIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("labelsLabel")}</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {labels.map((label) => {
                        const selected = field.value.includes(label.id);
                        return (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() =>
                              field.onChange(
                                selected
                                  ? field.value.filter((id) => id !== label.id)
                                  : [...field.value, label.id],
                              )
                            }
                          >
                            <Badge
                              variant={selected ? "default" : "outline"}
                              className={cn(
                                "cursor-pointer transition-colors",
                                !selected && "text-muted-foreground",
                              )}
                            >
                              {label.name}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </FormItem>
                )}
              />
            )}

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
