"use client";

import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { cn } from "@/components/utils";
import {
  formatTimeOfDay,
  jalaliDateKeyFromParts,
  toPersianDigitsForLocale,
  WEEKDAY_KEY,
} from "@/lib/format-jalali";
import { moduleColorClasses } from "@/lib/module-colors";
import { jalaliWeekday, type JalaliDate } from "@lifeos/core/src/shared/jalali";
import type { CalendarItemResponse } from "@lifeos/contracts";

interface WeekViewProps {
  // 7 entries, Saturday first — see @lifeos/core's jalaliWeekDays.
  weekDays: JalaliDate[];
  today: JalaliDate;
  itemsByDay: Map<string, CalendarItemResponse[]>;
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: () => void;
}

function isSameDay(a: JalaliDate, b: JalaliDate) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function WeekView({
  weekDays,
  today,
  itemsByDay,
  onSelectEvent,
  onCreateEvent,
}: WeekViewProps) {
  const locale = useLocale() as "fa" | "en";
  const t = useTranslations("Calendar");

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((day) => {
        const key = jalaliDateKeyFromParts(day.year, day.month, day.day);
        const items = itemsByDay.get(key) ?? [];
        const isToday = isSameDay(day, today);
        const weekdayLabel = t(WEEKDAY_KEY[jalaliWeekday(day)]!);

        return (
          <div
            key={key}
            className={cn(
              "flex min-h-40 flex-col gap-1.5 rounded-md border p-2",
              isToday && "border-module-calendar bg-module-calendar-subtle/40",
            )}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{weekdayLabel}</span>
              <span className={cn("font-medium", isToday && "text-module-calendar")}>
                {toPersianDigitsForLocale(day.day, locale)}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              {items.length === 0 ? (
                <button
                  type="button"
                  onClick={onCreateEvent}
                  aria-label={t("newEvent")}
                  className="flex flex-1 items-center justify-center rounded-sm text-muted-foreground/40 transition-colors hover:bg-accent hover:text-muted-foreground"
                >
                  <Plus className="size-3.5" />
                </button>
              ) : (
                items.map((item, idx) => (
                  <WeekItemChip
                    key={item.source === "event" ? item.eventId : `${key}-${item.source}-${idx}`}
                    item={item}
                    locale={locale}
                    onSelect={
                      item.source === "event" ? () => onSelectEvent(item.eventId) : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekItemChip({
  item,
  locale,
  onSelect,
}: {
  item: CalendarItemResponse;
  locale: "fa" | "en";
  onSelect?: (() => void) | undefined;
}) {
  const timeLabel = item.allDay ? null : formatTimeOfDay(item.start, locale);
  const colorClass =
    item.source === "event"
      ? moduleColorClasses("calendar").chip
      : item.source === "task"
        ? moduleColorClasses("tasks").chip
        : "bg-destructive/10 text-destructive";

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter") onSelect();
            }
          : undefined
      }
      className={cn(
        "flex flex-col gap-0.5 rounded-sm px-1.5 py-1 text-start text-xs leading-tight",
        colorClass,
        onSelect && "cursor-pointer hover:opacity-80",
      )}
    >
      <span className="truncate font-medium">{item.title}</span>
      {timeLabel && <span className="opacity-80">{timeLabel}</span>}
    </div>
  );
}
