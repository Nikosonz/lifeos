"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calendarApi } from "@/lib/calendar-api";
import {
  formatJalaliMonthLabel,
  formatJalaliDate,
  currentJalaliYearMonth,
  jalaliDateKey,
} from "@/lib/format-jalali";
import { useJalaliMonth } from "@/lib/hooks/use-jalali-month";
import { EventFormDialog } from "./_components/event-form-dialog";
import { AgendaItemRow } from "./_components/agenda-item-row";
import { ConfirmDeleteDialog } from "../_components/confirm-delete-dialog";
import type { CalendarItemResponse } from "@lifeos/contracts";

export default function CalendarPage() {
  const t = useTranslations("Calendar");
  const c = useTranslations("Common");
  const locale = useLocale() as "fa" | "en";
  const month = useJalaliMonth(currentJalaliYearMonth());
  const queryClient = useQueryClient();

  const [dialogEventId, setDialogEventId] = useState<string | null | undefined>(undefined);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["calendar", "agenda", month.year, month.month],
    queryFn: () => calendarApi.getAgenda({ jalaliYear: month.year, jalaliMonth: month.month }),
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
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button size="sm" onClick={() => setDialogEventId(null)}>
          <Plus className="size-4" />
          {t("newEvent")}
        </Button>
      </div>

      <div className="flex items-center gap-1 self-center">
        <Button variant="outline" size="icon-sm" onClick={month.prev} aria-label={t("prevMonth")}>
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
        <span className="min-w-32 text-center text-sm font-medium">
          {formatJalaliMonthLabel(month.year, month.month, locale)}
        </span>
        <Button variant="outline" size="icon-sm" onClick={month.next} aria-label={t("nextMonth")}>
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">{c("loading")}</p>}
      {isError && <p className="text-sm text-destructive">{c("unexpectedError")}</p>}
      {!isPending && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

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
