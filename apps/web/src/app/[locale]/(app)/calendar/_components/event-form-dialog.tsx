"use client";

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
import { WEEKDAY_KEY, WEEKDAY_INDICES } from "@/lib/format-jalali";
import { CalendarRecurrenceFreq } from "@lifeos/contracts";
import type {
  CalendarEventCreateInput,
  CalendarEventUpdateInput,
  CalendarEventResponse,
} from "@lifeos/contracts";
import { calendarApi } from "@/lib/calendar-api";
import { useResetFormOnFetchedEntity } from "@/lib/hooks/use-reset-form-on-fetched-entity";

const NO_RECURRENCE = "NONE";
const END_NEVER = "never";
const END_COUNT = "count";
const END_UNTIL = "until";

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

  useResetFormOnFetchedEntity(
    form,
    open,
    eventId,
    eventData,
    (e: CalendarEventResponse): EventFormValues => ({
      title: e.title,
      description: e.description ?? "",
      startAt: toDatetimeLocal(e.startAt),
      endAt: toDatetimeLocal(e.endAt),
      allDay: e.allDay,
      recurrenceFreq: e.recurrenceFreq ?? NO_RECURRENCE,
      recurrenceInterval: e.recurrenceInterval,
      recurrenceByWeekday: e.recurrenceByWeekday,
      endType: e.recurrenceCount ? END_COUNT : e.recurrenceUntil ? END_UNTIL : END_NEVER,
      recurrenceCount: e.recurrenceCount ? String(e.recurrenceCount) : "",
      recurrenceUntil: e.recurrenceUntil ? e.recurrenceUntil.slice(0, 10) : "",
    }),
    () => DEFAULT_VALUES,
  );

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
  // A second, narrower version of the same race: disabling only Save stops
  // a stale *submit*, but not a keystroke typed into the title/etc. while
  // the fetch above is still in flight — useResetFormOnFetchedEntity's
  // form.reset() fires the instant it lands and silently discards whatever
  // was typed in that window, even though Save itself was correctly still
  // disabled at the time. Wrapping the fields (not just Save) in a disabled
  // fieldset closes the window entirely: nothing is editable until the
  // fetched values are already the ones on screen. display:contents keeps
  // this purely behavioral — no layout/visual change vs. the fields being
  // direct form children.

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
            <fieldset disabled={isLoadingEventData} className="contents">
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
                            {WEEKDAY_INDICES.map((day) => {
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
            </fieldset>

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
