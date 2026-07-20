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
import type { ProjectResponse } from "@lifeos/contracts";
import { ProjectFormDialog } from "./_components/project-form-dialog";
import { ConfirmDeleteDialog } from "../../_components/confirm-delete-dialog";

export default function TaskProjectsPage() {
  const t = useTranslations("TaskProjects");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  const [dialogProject, setDialogProject] = useState<ProjectResponse | null | undefined>(undefined);
  const [deletingProject, setDeletingProject] = useState<ProjectResponse | null>(null);

  const { data } = useQuery({
    queryKey: ["tasks", "projects"],
    queryFn: () => tasksApi.listProjects(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(c("delete"));
      setDeletingProject(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button size="sm" onClick={() => setDialogProject(null)}>
          <Plus className="size-4" />
          {t("newProject")}
        </Button>
      </div>

      {data && data.projects.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      {data && data.projects.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("nameLabel")}</TableHead>
              <TableHead>{t("descriptionLabel")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {project.description ?? "—"}
                </TableCell>
                <TableCell className="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDialogProject(project)}>
                        {c("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeletingProject(project)}
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

      <ProjectFormDialog
        open={dialogProject !== undefined}
        onOpenChange={(open) => !open && setDialogProject(undefined)}
        project={dialogProject ?? null}
      />

      <ConfirmDeleteDialog
        open={deletingProject !== null}
        onOpenChange={(open) => !open && setDeletingProject(null)}
        onConfirm={() => deletingProject && deleteMutation.mutate(deletingProject.id)}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
