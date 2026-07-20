"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tasksApi } from "@/lib/tasks-api";
import type { LabelResponse } from "@lifeos/contracts";
import { LabelFormDialog } from "./_components/label-form-dialog";
import { ConfirmDeleteDialog } from "../../_components/confirm-delete-dialog";

export default function TaskLabelsPage() {
  const t = useTranslations("TaskLabels");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  const [dialogLabel, setDialogLabel] = useState<LabelResponse | null | undefined>(undefined);
  const [deletingLabel, setDeletingLabel] = useState<LabelResponse | null>(null);

  const { data } = useQuery({
    queryKey: ["tasks", "labels"],
    queryFn: () => tasksApi.listLabels(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.deleteLabel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(c("delete"));
      setDeletingLabel(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button size="sm" onClick={() => setDialogLabel(null)}>
          <Plus className="size-4" />
          {t("newLabel")}
        </Button>
      </div>

      {data && data.labels.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      {data && data.labels.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("nameLabel")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.labels.map((label) => (
              <TableRow key={label.id}>
                <TableCell className="font-medium">{label.name}</TableCell>
                <TableCell className="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDialogLabel(label)}>
                        {c("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeletingLabel(label)}
                      >
                        {c("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <LabelFormDialog
        open={dialogLabel !== undefined}
        onOpenChange={(open) => !open && setDialogLabel(undefined)}
        label={dialogLabel ?? null}
      />

      <ConfirmDeleteDialog
        open={deletingLabel !== null}
        onOpenChange={(open) => !open && setDeletingLabel(null)}
        onConfirm={() => deletingLabel && deleteMutation.mutate(deletingLabel.id)}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
