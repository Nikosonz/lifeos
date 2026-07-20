"use client";

import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/utils";
import { formatJalaliDate } from "@/lib/format-jalali";
import type { TaskResponse } from "@lifeos/contracts";
import { StatusBadge, PriorityBadge, statusMessageKey, priorityMessageKey } from "./task-badges";

export function TaskRow({
  task,
  projectName,
  labelNames,
  onEdit,
  onSubtasks,
  onDelete,
}: {
  task: TaskResponse;
  projectName: string | null;
  labelNames: string[];
  onEdit: () => void;
  onSubtasks: () => void;
  onDelete: () => void;
}) {
  const locale = useLocale() as "fa" | "en";
  const t = useTranslations("Tasks");
  const c = useTranslations("Common");
  const done = task.status === "DONE" || task.status === "CANCELLED";

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className={cn("truncate font-medium", done && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <StatusBadge status={task.status} label={t(statusMessageKey(task.status))} />
          <PriorityBadge priority={task.priority} label={t(priorityMessageKey(task.priority))} />
          {projectName && <span>{projectName}</span>}
          {task.deadline && <span>{formatJalaliDate(task.deadline, locale)}</span>}
          {labelNames.map((name) => (
            <Badge key={name} variant="outline" className="text-muted-foreground">
              {name}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>{c("edit")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={onSubtasks}>{t("subtasksAction")}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              {c("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
