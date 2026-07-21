"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils";
import { habitsApi } from "@/lib/habits-api";
import { useJalaliMonth } from "@/lib/hooks/use-jalali-month";
import {
  currentJalaliYearMonth,
  formatJalaliMonthLabel,
  toPersianDigitsForLocale,
} from "@/lib/format-jalali";
// Deep import, same rationale as format-jalali.ts: shared/jalali.ts has zero
// @lifeos/db dependency, so it's safe to pull into a client bundle without
// dragging in the Prisma client via @lifeos/core's barrel.
import { jalaliMonthDays, jalaliWeekday } from "@lifeos/core/src/shared/jalali";

// Saturday-first, matching every other Saturday-start weekday header this
// app renders (Calendar's Week view). Short single/double-letter forms are
// purely presentational (grid header only) — the full names already live
// under the Habits namespace for the form's weekday multi-select.
const SHORT_WEEKDAY_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const SHORT_WEEKDAY_EN = ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"];

export function HabitMonthGrid({
  habitId,
  frequency,
  weekdays,
}: {
  habitId: string;
  frequency: "DAILY" | "WEEKLY";
  weekdays: number[];
}) {
  const t = useTranslations("Habits");
  const locale = useLocale() as "fa" | "en";
  const month = useJalaliMonth(currentJalaliYearMonth());
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["habits", "checkins", habitId, month.year, month.month],
    queryFn: () => habitsApi.listCheckIns(habitId, month.year, month.month),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      checked,
      date,
    }: {
      checked: boolean;
      date: { jalaliYear: number; jalaliMonth: number; jalaliDay: number };
    }) => {
      if (checked) {
        await habitsApi.uncheck(habitId, date);
      } else {
        await habitsApi.checkIn(habitId, date);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["habits"] }),
  });

  const checkedDayNumbers = new Set(
    (data?.checkIns ?? [])
      .filter((c) => c.jalaliYear === month.year && c.jalaliMonth === month.month)
      .map((c) => c.jalaliDay),
  );

  const days = jalaliMonthDays(month.year, month.month);
  // Saturday-first column index for a given JS weekday (0=Sun..6=Sat) —
  // same (w+1)%7 mapping jalaliWeekDays uses internally to find "days since
  // Saturday".
  const leadingOffset = (jalaliWeekday(days[0]!) + 1) % 7;
  const shortWeekdays = locale === "fa" ? SHORT_WEEKDAY_FA : SHORT_WEEKDAY_EN;

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon-sm" onClick={month.prev} aria-label={t("prevMonth")}>
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
        <span className="text-sm font-medium">
          {formatJalaliMonthLabel(month.year, month.month, locale)}
        </span>
        <Button variant="outline" size="icon-sm" onClick={month.next} aria-label={t("nextMonth")}>
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
      </div>

      {isPending ? (
        <p className="text-muted-foreground text-center text-sm">{t("loadingGrid")}</p>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {shortWeekdays.map((label, i) => (
            <div key={i} className="text-muted-foreground text-center text-xs">
              {label}
            </div>
          ))}

          {Array.from({ length: leadingOffset }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {days.map((day) => {
            const scheduled = frequency === "DAILY" || weekdays.includes(jalaliWeekday(day));
            const checked = checkedDayNumbers.has(day.day);
            return (
              <button
                key={day.day}
                type="button"
                disabled={!scheduled || toggleMutation.isPending}
                onClick={() =>
                  toggleMutation.mutate({
                    checked,
                    date: { jalaliYear: day.year, jalaliMonth: day.month, jalaliDay: day.day },
                  })
                }
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-xs transition-colors",
                  !scheduled && "text-muted-foreground/40",
                  scheduled && !checked && "hover:bg-accent border text-foreground",
                  checked && "bg-module-habits text-module-habits-foreground",
                )}
              >
                {toPersianDigitsForLocale(day.day, locale)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
