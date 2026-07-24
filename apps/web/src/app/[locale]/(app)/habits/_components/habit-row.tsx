"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Flame, Check, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/utils";
import { toPersianDigitsForLocale, WEEKDAY_KEY } from "@/lib/format-jalali";
import type { HabitResponse } from "@lifeos/contracts";
import { HabitMonthGrid } from "./habit-month-grid";

export function HabitRow({
  habit,
  onToggleToday,
  onEdit,
  onDelete,
}: {
  habit: HabitResponse;
  onToggleToday: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const locale = useLocale() as "fa" | "en";
  const t = useTranslations("Habits");
  const c = useTranslations("Common");
  const [gridOpen, setGridOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium">{habit.name}</span>
          {habit.description && (
            <span className="text-muted-foreground truncate text-sm">{habit.description}</span>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="outline" className="text-muted-foreground">
              {habit.frequency === "DAILY" ? t("frequencyDaily") : t("frequencyWeekly")}
            </Badge>
            {habit.frequency === "WEEKLY" &&
              habit.weekdays.map((day) => (
                <Badge key={day} variant="outline" className="text-muted-foreground">
                  {t(WEEKDAY_KEY[day]!)}
                </Badge>
              ))}
            <span className="text-module-habits flex items-center gap-1 font-medium">
              <Flame className="size-3.5" />
              {t("streakCount", { count: toPersianDigitsForLocale(habit.streak, locale) })}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={habit.checkedToday ? "default" : "outline"}
            size="sm"
            onClick={onToggleToday}
            className={cn(habit.checkedToday && "bg-module-habits text-module-habits-foreground")}
          >
            <Check className="size-4" />
            {habit.checkedToday ? t("doneToday") : t("markToday")}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setGridOpen((v) => !v)}
            aria-label={t("monthGridToggle")}
          >
            {gridOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>{c("edit")}</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                {c("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {gridOpen && (
        <HabitMonthGrid habitId={habit.id} frequency={habit.frequency} weekdays={habit.weekdays} />
      )}
    </div>
  );
}
