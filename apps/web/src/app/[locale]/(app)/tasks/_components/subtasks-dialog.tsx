"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/components/utils";
import { tasksApi } from "@/lib/tasks-api";

export function SubtasksDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
  taskTitle: string;
}) {
  const t = useTranslations("Subtasks");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { data } = useQuery({
    queryKey: ["tasks", "subtasks", taskId],
    queryFn: () => tasksApi.listSubtasks(taskId!),
    enabled: taskId !== null,
  });

  function invalidate() {
    // Whole "tasks" prefix, not a narrow key — same convention Finance's
    // mutations already established (see CLAUDE.md's Web UI Architecture).
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  const createMutation = useMutation({
    mutationFn: (title: string) => tasksApi.createSubtask(taskId!, { title }),
    onSuccess: () => {
      setNewTitle("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) =>
      tasksApi.updateSubtask(taskId!, subtaskId, { completed }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (subtaskId: string) => tasksApi.deleteSubtask(taskId!, subtaskId),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const subtasks = data?.subtasks ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { taskTitle })}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {subtasks.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
          )}
          {subtasks.map((subtask) => (
            <div key={subtask.id} className="flex items-center gap-2">
              <Checkbox
                checked={subtask.completed}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ subtaskId: subtask.id, completed: checked === true })
                }
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  subtask.completed && "text-muted-foreground line-through",
                )}
              >
                {subtask.title}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => deleteMutation.mutate(subtask.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) createMutation.mutate(newTitle.trim());
          }}
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t("newSubtask")}
          />
          <Button type="submit" size="sm" disabled={!newTitle.trim() || createMutation.isPending}>
            {c("add")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
