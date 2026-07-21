"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tasksApi } from "@/lib/tasks-api";
import { TaskStatus } from "@lifeos/contracts";
import type { TaskResponse } from "@lifeos/contracts";
import { TaskFormDialog } from "./_components/task-form-dialog";
import { TaskRow } from "./_components/task-row";
import { SubtasksDialog } from "./_components/subtasks-dialog";
import { statusMessageKey } from "./_components/task-badges";
import { ConfirmDeleteDialog } from "../_components/confirm-delete-dialog";
import { PageHelp } from "../_components/page-help";

const STATUS_ALL = "__all__";

export default function TasksPage() {
  const t = useTranslations("Tasks");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>(STATUS_ALL);
  const [dialogTask, setDialogTask] = useState<TaskResponse | null | undefined>(undefined);
  const [deletingTask, setDeletingTask] = useState<TaskResponse | null>(null);
  const [subtasksTask, setSubtasksTask] = useState<TaskResponse | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ["tasks", "projects"],
    queryFn: () => tasksApi.listProjects(),
  });
  const { data: labelsData } = useQuery({
    queryKey: ["tasks", "labels"],
    queryFn: () => tasksApi.listLabels(),
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery({
    queryKey: ["tasks", "list", statusFilter],
    queryFn: ({ pageParam }) =>
      tasksApi.listTasks({
        ...(pageParam !== undefined ? { cursor: pageParam } : {}),
        ...(statusFilter !== STATUS_ALL ? { status: statusFilter } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(c("delete"));
      setDeletingTask(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const projectNameById = new Map(
    (projectsData?.projects ?? []).map((project) => [project.id, project.name]),
  );
  const labelNameById = new Map((labelsData?.labels ?? []).map((label) => [label.id, label.name]));
  const tasks = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="border-module-tasks border-s-4 ps-3 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <PageHelp pageKey="tasks" />
        </div>
        <Button size="sm" onClick={() => setDialogTask(null)}>
          <Plus className="size-4" />
          {t("newTask")}
        </Button>
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-48" aria-label={t("statusLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={STATUS_ALL}>{t("statusAll")}</SelectItem>
          {TaskStatus.options.map((status) => (
            <SelectItem key={status} value={status}>
              {t(statusMessageKey(status))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!isPending && tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            projectName={task.projectId ? (projectNameById.get(task.projectId) ?? null) : null}
            labelNames={task.labelIds.map((id) => labelNameById.get(id) ?? "—")}
            onEdit={() => setDialogTask(task)}
            onSubtasks={() => setSubtasksTask(task)}
            onDelete={() => setDeletingTask(task)}
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

      <TaskFormDialog
        open={dialogTask !== undefined}
        onOpenChange={(open) => !open && setDialogTask(undefined)}
        task={dialogTask ?? null}
      />

      <SubtasksDialog
        open={subtasksTask !== null}
        onOpenChange={(open) => !open && setSubtasksTask(null)}
        taskId={subtasksTask?.id ?? null}
        taskTitle={subtasksTask?.title ?? ""}
      />

      <ConfirmDeleteDialog
        open={deletingTask !== null}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        onConfirm={() => deletingTask && deleteMutation.mutate(deletingTask.id)}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
