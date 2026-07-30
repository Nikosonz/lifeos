"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMutationErrorHandler } from "@/lib/hooks/use-mutation-error-handler";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { habitsApi } from "@/lib/habits-api";
import type { HabitResponse } from "@lifeos/contracts";
import { HabitFormDialog } from "./_components/habit-form-dialog";
import { HabitRow } from "./_components/habit-row";
import { ConfirmDeleteDialog } from "../_components/confirm-delete-dialog";
import { PageHelp } from "../_components/page-help";

export default function HabitsPage() {
  const t = useTranslations("Habits");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();
  const onMutationError = useMutationErrorHandler("habits");

  const [dialogHabit, setDialogHabit] = useState<HabitResponse | null | undefined>(undefined);
  const [deletingHabit, setDeletingHabit] = useState<HabitResponse | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["habits", "list"],
    queryFn: () => habitsApi.listHabits(),
  });

  const toggleTodayMutation = useMutation({
    mutationFn: async (habit: HabitResponse) => {
      if (habit.checkedToday) {
        await habitsApi.uncheck(habit.id);
      } else {
        await habitsApi.checkIn(habit.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["habits"] }),
    onError: onMutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: (habit: HabitResponse) => habitsApi.deleteHabit(habit.id, habit.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast.success(c("delete"));
      setDeletingHabit(null);
    },
    onError: onMutationError,
  });

  const habits = data?.habits ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="border-module-habits border-s-4 ps-3 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <PageHelp pageKey="habits" />
        </div>
        <Button size="sm" onClick={() => setDialogHabit(null)}>
          <Plus className="size-4" />
          {t("newHabit")}
        </Button>
      </div>

      {isPending && <p className="text-muted-foreground text-sm">{c("loading")}</p>}
      {isError && <p className="text-destructive text-sm">{c("unexpectedError")}</p>}
      {!isPending && habits.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("emptyState")}</p>
      )}

      <div className="flex flex-col gap-2">
        {habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            onToggleToday={() => toggleTodayMutation.mutate(habit)}
            onEdit={() => setDialogHabit(habit)}
            onDelete={() => setDeletingHabit(habit)}
          />
        ))}
      </div>

      <HabitFormDialog
        open={dialogHabit !== undefined}
        onOpenChange={(open) => !open && setDialogHabit(undefined)}
        habit={dialogHabit ?? null}
      />

      <ConfirmDeleteDialog
        open={deletingHabit !== null}
        onOpenChange={(open) => !open && setDeletingHabit(null)}
        onConfirm={() => deletingHabit && deleteMutation.mutate(deletingHabit)}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
