"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { HabitFrequency } from "@lifeos/contracts";
import type { HabitResponse, HabitCreateInput, HabitUpdateInput } from "@lifeos/contracts";
import { habitsApi } from "@/lib/habits-api";

// JS Date.getDay() convention (0=Sunday..6=Saturday) — same weekday mapping
// Calendar's recurrenceByWeekday multi-select already established for this
// exact "select which weekdays" UI shape (see event-form-dialog.tsx).
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

// Mirrors HabitCreateInput/HabitUpdateInput's own superRefine (weekdays
// required and non-empty when frequency is WEEKLY) so the form catches this
// inline instead of round-tripping to the server for a 400.
const habitFormSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    frequency: HabitFrequency,
    weekdays: z.array(z.number().int().min(0).max(6)),
  })
  .superRefine((data, ctx) => {
    if (data.frequency === "WEEKLY" && data.weekdays.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "weekdays is required and non-empty when frequency is WEEKLY",
        path: ["weekdays"],
      });
    }
  });
type HabitFormValues = z.infer<typeof habitFormSchema>;

const DEFAULT_VALUES: HabitFormValues = {
  name: "",
  description: "",
  frequency: "DAILY",
  weekdays: [],
};

export function HabitFormDialog({
  open,
  onOpenChange,
  habit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: HabitResponse | null; // null = create mode
}) {
  const t = useTranslations("Habits");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  const form = useForm<HabitFormValues>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      habit
        ? {
            name: habit.name,
            description: habit.description ?? "",
            frequency: habit.frequency,
            weekdays: habit.weekdays,
          }
        : DEFAULT_VALUES,
    );
  }, [open, habit, form]);

  const mutation = useMutation({
    mutationFn: (values: HabitFormValues) => {
      const weekdays = values.frequency === "WEEKLY" ? values.weekdays : undefined;

      if (habit) {
        const input: HabitUpdateInput = {
          name: values.name,
          description: values.description ? values.description : null,
          frequency: values.frequency,
          ...(weekdays !== undefined ? { weekdays } : {}),
        };
        return habitsApi.updateHabit(habit.id, input);
      }

      const input: HabitCreateInput = {
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
        frequency: values.frequency,
        ...(weekdays !== undefined ? { weekdays } : {}),
      };
      return habitsApi.createHabit(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast.success(c("save"));
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const frequency = form.watch("frequency");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{habit ? t("editHabit") : t("newHabit")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("nameLabel")}</FormLabel>
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
                    <Textarea {...field} maxLength={500} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("frequencyLabel")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DAILY">{t("frequencyDaily")}</SelectItem>
                      <SelectItem value="WEEKLY">{t("frequencyWeekly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {frequency === "WEEKLY" && (
              <FormField
                control={form.control}
                name="weekdays"
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {c("save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
