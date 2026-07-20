"use client";

import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTimeOfDay } from "@/lib/format-jalali";
import type { CalendarItemResponse } from "@lifeos/contracts";
import {
  StatusBadge,
  PriorityBadge,
  statusMessageKey,
  priorityMessageKey,
} from "../../tasks/_components/task-badges";

// Task/holiday items are read-only projections composed server-side (see
// the Calendar module plan's decision 8) — editing a task deadline happens
// in the Tasks module, never here, so onEdit/onDelete are undefined for
// anything but source:"event".
export function AgendaItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: CalendarItemResponse;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}) {
  const locale = useLocale() as "fa" | "en";
  const t = useTranslations("Calendar");
  const tTasks = useTranslations("Tasks");
  const c = useTranslations("Common");

  const timeLabel = item.allDay
    ? null
    : `${formatTimeOfDay(item.start, locale)}–${formatTimeOfDay(item.end, locale)}`;

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium">{item.title}</span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {timeLabel && <span>{timeLabel}</span>}
          {item.source === "event" && item.isRecurring && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Repeat className="size-3" />
              {t("recurringBadge")}
            </Badge>
          )}
          {item.source === "task" && (
            <>
              <StatusBadge status={item.status} label={tTasks(statusMessageKey(item.status))} />
              <PriorityBadge
                priority={item.priority}
                label={tTasks(priorityMessageKey(item.priority))}
              />
            </>
          )}
          {item.source === "holiday" && <Badge variant="outline">{t("holidayBadge")}</Badge>}
        </div>
      </div>
      {(onEdit ?? onDelete) && (
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && <DropdownMenuItem onSelect={onEdit}>{c("edit")}</DropdownMenuItem>}
              {onDelete && (
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  {c("delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
