"use client";

import { useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/components/utils";
import { CalendarRecurrenceFreq } from "@lifeos/contracts";
import type { CalendarEventCreateInput, CalendarEventUpdateInput } from "@lifeos/contracts";
import { calendarApi } from "@/lib/calendar-api";

const NO_RECURRENCE = "NONE";
const END_NEVER = "never";
const END_COUNT = "count";
const END_UNTIL = "until";

// JS Date.getDay() convention (0=Sunday..6=Saturday) — same mapping the
// server's recurrence.ts wrapper uses internally, never rrule's own
// Monday-based enum (see the Calendar module plan's decision 2).
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKDAY_KEY: Record<number, string> = {
  0: "weekdaySun",
  1: "weekdayMon",
  2: "weekdayTue",
  3: "weekdayWed",
  4: "weekdayThu",
  5: "weekdayFri",
  6: "weekdaySat",
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

const eventFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  allDay: z.boolean(),
  recurrenceFreq: z.enum([NO_RECURRENCE, ...CalendarRecurrenceFreq.options]),
  recurrenceInterval: z.number().int().min(1).max(365),
  recurrenceByWeekday: z.array(z.number().int().min(0).max(6)),
  endType: z.enum([END_NEVER, END_COUNT, END_UNTIL]),
  recurrenceCount: z.string(), // numeric string or "" — parsed at submit time
  recurrenceUntil: z.string(), // "" or YYYY-MM-DD — parsed at submit time
});
type EventFormValues = z.infer<typeof eventFormSchema>;

const DEFAULT_VALUES: EventFormValues = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  allDay: false,
  recurrenceFreq: NO_RECURRENCE,
  recurrenceInterval: 1,
  recurrenceByWeekday: [],
  endType: END_NEVER,
  recurrenceCount: "",
  recurrenceUntil: "",
};

export function EventFormDialog({
  open,
  onOpenChange,
  eventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null; // null = create mode
}) {
  const t = useTranslations("Calendar");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  // Agenda items only carry occurrence-projection fields (title/start/end),
  // not the full recurrence record — fetch the actual series when editing.
  const { data: eventData } = useQuery({
    queryKey: ["calendar", "event", eventId],
    queryFn: () => calendarApi.getEvent(eventId!),
    enabled: open && eventId !== null,
  });

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (eventId === null) {
      form.reset(DEFAULT_VALUES);
      return;
    }
    if (!eventData) return;
    form.reset({
      title: eventData.title,
      description: eventData.description ?? "",
      startAt: toDatetimeLocal(eventData.startAt),
      endAt: toDatetimeLocal(eventData.endAt),
      allDay: eventData.allDay,
      recurrenceFreq: eventData.recurrenceFreq ?? NO_RECURRENCE,
      recurrenceInterval: eventData.recurrenceInterval,
      recurrenceByWeekday: eventData.recurrenceByWeekday,
      endType: eventData.recurrenceCount
        ? END_COUNT
        : eventData.recurrenceUntil
          ? END_UNTIL
          : END_NEVER,
      recurrenceCount: eventData.recurrenceCount ? String(eventData.recurrenceCount) : "",
      recurrenceUntil: eventData.recurrenceUntil ? eventData.recurrenceUntil.slice(0, 10) : "",
    });
    // eventData is the specific record being edited (fetched by eventId,
    // not a derived list) — same shape as TaskFormDialog depending on its
    // `task` prop directly (see CLAUDE.md's Web UI Architecture note).
  }, [open, eventId, eventData, form]);

  const mutation = useMutation({
    mutationFn: (values: EventFormValues) => {
      const recurrenceFreq =
        values.recurrenceFreq === NO_RECURRENCE ? undefined : values.recurrenceFreq;
      const count = Number(values.recurrenceCount);
      const shared = {
        title: values.title,
        startAt: fromDatetimeLocal(values.startAt),
        endAt: fromDatetimeLocal(values.endAt),
        allDay: values.allDay,
        ...(recurrenceFreq
          ? {
              recurrenceFreq,
              recurrenceInterval: values.recurrenceInterval,
              ...(recurrenceFreq === "WEEKLY" && values.recurrenceByWeekday.length > 0
                ? { recurrenceByWeekday: values.recurrenceByWeekday }
                : {}),
              ...(values.endType === END_COUNT && count >= 1 ? { recurrenceCount: count } : {}),
              ...(values.endType === END_UNTIL && values.recurrenceUntil
                ? {
                    recurrenceUntil: new Date(
                      `${values.recurrenceUntil}T23:59:59.999Z`,
                    ).toISOString(),
                  }
                : {}),
            }
          : {}),
      };

      if (eventId !== null) {
        const input: CalendarEventUpdateInput = {
          ...shared,
          ...(values.description ? { description: values.description } : {}),
        };
        return calendarApi.updateEvent(eventId, input);
      }

      const input: CalendarEventCreateInput = {
        ...shared,
        ...(values.description ? { description: values.description } : {}),
      };
      return calendarApi.createEvent(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(c("save"));
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const recurrenceFreq = form.watch("recurrenceFreq");
  const endType = form.watch("endType");

  // Unlike Tasks/Finance's dialogs (which always receive the full entity as
  // a prop already sitting in the parent's query cache), Agenda's occurrence
  // items don't carry recurrence fields, so editing requires this dialog's
  // own per-open GET fetch. Without disabling Save until it resolves, a fast
  // client can submit while the form still holds the *previous* dialog
  // session's values — confirmed by e2e/calendar.spec.ts, which submitted
  // before the fetch landed and silently carried over the previously-edited
  // event's time range and recurrence into the new one. The form is never
  // conditionally unmounted for this (e.g. swapped for a loading message) —
  // react-hook-form's Controller-bound fields re-registering on remount
  // picked up useForm()'s static initial defaultValues instead of the
  // freshly form.reset() 'd values, reproducing the exact same bug one
  // layer deeper (recurrenceFreq silently reverting to a value that matched
  // no SelectItem).
  const isLoadingEventData = eventId !== null && !eventData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{eventId !== null ? t("editEvent") : t("newEvent")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
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
                name="startAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("startLabel")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="datetime-local" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("endLabel")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="datetime-local" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">{t("allDayLabel")}</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recurrenceFreq"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("recurrenceLabel")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_RECURRENCE}>{t("recurrenceNone")}</SelectItem>
                      <SelectItem value="DAILY">{t("recurrenceDaily")}</SelectItem>
                      <SelectItem value="WEEKLY">{t("recurrenceWeekly")}</SelectItem>
                      <SelectItem value="MONTHLY">{t("recurrenceMonthly")}</SelectItem>
                      <SelectItem value="YEARLY">{t("recurrenceYearly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {recurrenceFreq !== NO_RECURRENCE && (
              <>
                <FormField
                  control={form.control}
                  name="recurrenceInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("intervalLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={365}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 1)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {recurrenceFreq === "WEEKLY" && (
                  <FormField
                    control={form.control}
                    name="recurrenceByWeekday"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("weekdaysLabel")}</FormLabel>
                        <div className="flex flex-wrap gap-2">
                          {WEEKDAYS.map((day) => {
                            const selected = field.value.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() =>
                                  field.onChange(
                                    selected
                                      ? field.value.filter((d) => d !== day)
                                      : [...field.value, day],
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
                                  {t(WEEKDAY_KEY[day]!)}
                                </Badge>
                              </button>
                            );
                          })}
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="endType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("endTypeLabel")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={END_NEVER}>{t("endNever")}</SelectItem>
                          <SelectItem value={END_COUNT}>{t("endAfterCount")}</SelectItem>
                          <SelectItem value={END_UNTIL}>{t("endOnDate")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {endType === END_COUNT && (
                  <FormField
                    control={form.control}
                    name="recurrenceCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("countLabel")}</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={1} max={1000} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {endType === END_UNTIL && (
                  <FormField
                    control={form.control}
                    name="recurrenceUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("untilLabel")}</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending || isLoadingEventData}>
                {c("save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
