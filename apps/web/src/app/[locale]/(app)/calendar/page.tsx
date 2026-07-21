"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils";
import { calendarApi } from "@/lib/calendar-api";
import {
  formatJalaliMonthLabel,
  formatJalaliWeekLabel,
  formatJalaliDate,
  currentJalaliYearMonth,
  currentJalaliDate,
  jalaliDateKey,
} from "@/lib/format-jalali";
import { useJalaliMonth } from "@/lib/hooks/use-jalali-month";
import { useJalaliWeek } from "@/lib/hooks/use-jalali-week";
import { jalaliWeekDays, jalaliWeekRangeUtc } from "@lifeos/core/src/shared/jalali";
import { EventFormDialog } from "./_components/event-form-dialog";
import { AgendaItemRow } from "./_components/agenda-item-row";
import { WeekView } from "./_components/week-view";
import { ConfirmDeleteDialog } from "../_components/confirm-delete-dialog";
import { PageHelp } from "../_components/page-help";
import type { CalendarItemResponse } from "@lifeos/contracts";

type CalendarView = "agenda" | "week";
const VIEW_STORAGE_KEY = "lifeos:calendar-view";

export default function CalendarPage() {
  const t = useTranslations("Calendar");
  const c = useTranslations("Common");
  const locale = useLocale() as "fa" | "en";
  const today = currentJalaliDate();
  const month = useJalaliMonth(currentJalaliYearMonth());
  const week = useJalaliWeek(today);
  const queryClient = useQueryClient();

  // Presentation-only preference (which view a user last looked at), so a
  // localStorage read is fine here — this is not business data, unlike
  // everything else the app stores server-side. Defaults to "agenda" on
  // first render (including the server-rendered pass) and only switches
  // after mount, matching AuthGate's already-documented brief-flash
  // trade-off rather than risking a hydration mismatch.
  const [view, setView] = useState<CalendarView>("agenda");
  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "agenda" || stored === "week") setView(stored);
  }, []);
  const changeView = (next: CalendarView) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  const [dialogEventId, setDialogEventId] = useState<string | null | undefined>(undefined);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const weekDays = jalaliWeekDays(week.anchor);
  const weekRange = jalaliWeekRangeUtc(week.anchor);

  const { data, isPending, isError } = useQuery({
    queryKey:
      view === "agenda"
        ? ["calendar", "agenda", month.year, month.month]
        : ["calendar", "agenda", "week", weekRange.gte.toISOString()],
    queryFn: () =>
      view === "agenda"
        ? calendarApi.getAgenda({ jalaliYear: month.year, jalaliMonth: month.month })
        : calendarApi.getAgenda({
            from: weekRange.gte.toISOString(),
            to: weekRange.lt.toISOString(),
          }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calendarApi.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(c("delete"));
      setDeletingEventId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = data?.items ?? [];
  // Items arrive server-sorted chronologically (agenda-service's merge+sort)
  // — a plain Map preserves that insertion order, so no re-sort needed here.
  const groups = new Map<string, CalendarItemResponse[]>();
  for (const item of items) {
    const key = jalaliDateKey(item.start);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return (
    <div className={cn("mx-auto flex flex-col gap-4", view === "week" ? "max-w-5xl" : "max-w-3xl")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="border-module-calendar border-s-4 ps-3 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <PageHelp pageKey="calendar" />
        </div>
        <Button size="sm" onClick={() => setDialogEventId(null)}>
          <Plus className="size-4" />
          {t("newEvent")}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1 rounded-md border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "agenda" ? "secondary" : "ghost"}
            onClick={() => changeView("agenda")}
          >
            {t("viewAgenda")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "week" ? "secondary" : "ghost"}
            onClick={() => changeView("week")}
          >
            {t("viewWeek")}
          </Button>
        </div>

        {view === "agenda" ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={month.prev}
              aria-label={t("prevMonth")}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium">
              {formatJalaliMonthLabel(month.year, month.month, locale)}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={month.next}
              aria-label={t("nextMonth")}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={week.prev} aria-label={t("prevWeek")}>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => week.goToday(today)}>
              {t("today")}
            </Button>
            <span className="min-w-40 text-center text-sm font-medium">
              {formatJalaliWeekLabel(weekDays, locale)}
            </span>
            <Button variant="outline" size="icon-sm" onClick={week.next} aria-label={t("nextWeek")}>
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        )}
      </div>

      {isPending && <p className="text-sm text-muted-foreground">{c("loading")}</p>}
      {isError && <p className="text-sm text-destructive">{c("unexpectedError")}</p>}
      {!isPending && items.length === 0 && view === "agenda" && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      {view === "agenda" ? (
        <div className="flex flex-col gap-4">
          {[...groups.entries()].map(([key, dayItems]) => (
            <div key={key} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {formatJalaliDate(dayItems[0]!.start, locale)}
              </h2>
              <div className="flex flex-col gap-2">
                {dayItems.map((item, idx) => (
                  <AgendaItemRow
                    key={item.source === "event" ? item.eventId : `${key}-${item.source}-${idx}`}
                    item={item}
                    onEdit={
                      item.source === "event" ? () => setDialogEventId(item.eventId) : undefined
                    }
                    onDelete={
                      item.source === "event" ? () => setDeletingEventId(item.eventId) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isPending && (
          <WeekView
            weekDays={weekDays}
            today={today}
            itemsByDay={groups}
            onSelectEvent={(eventId) => setDialogEventId(eventId)}
            onCreateEvent={() => setDialogEventId(null)}
          />
        )
      )}

      <EventFormDialog
        open={dialogEventId !== undefined}
        onOpenChange={(open) => !open && setDialogEventId(undefined)}
        eventId={dialogEventId ?? null}
      />

      <ConfirmDeleteDialog
        open={deletingEventId !== null}
        onOpenChange={(open) => !open && setDeletingEventId(null)}
        onConfirm={() => deletingEventId && deleteMutation.mutate(deletingEventId)}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
