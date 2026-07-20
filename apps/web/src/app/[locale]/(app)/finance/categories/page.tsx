"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { financeApi } from "@/lib/finance-api";
import type { CategoryResponse } from "@lifeos/contracts";
import { CategoryFormDialog } from "./_components/category-form-dialog";
import { ConfirmDeleteDialog } from "../../_components/confirm-delete-dialog";

export default function CategoriesPage() {
  const t = useTranslations("Categories");
  const c = useTranslations("Common");
  const queryClient = useQueryClient();

  const [dialogCategory, setDialogCategory] = useState<CategoryResponse | null | undefined>(
    undefined,
  );
  const [deletingCategory, setDeletingCategory] = useState<CategoryResponse | null>(null);

  const { data } = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: () => financeApi.listCategories(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success(c("delete"));
      setDeletingCategory(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button size="sm" onClick={() => setDialogCategory(null)}>
          <Plus className="size-4" />
          {t("newCategory")}
        </Button>
      </div>

      {data && data.categories.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      {data && data.categories.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("nameLabel")}</TableHead>
              <TableHead>{t("typeLabel")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>
                  <Badge variant={category.type === "INCOME" ? "default" : "secondary"}>
                    {category.type === "INCOME" ? t("typeIncome") : t("typeExpense")}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDialogCategory(category)}>
                        {c("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeletingCategory(category)}
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

      <CategoryFormDialog
        open={dialogCategory !== undefined}
        onOpenChange={(open) => !open && setDialogCategory(undefined)}
        category={dialogCategory ?? null}
      />

      <ConfirmDeleteDialog
        open={deletingCategory !== null}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
        onConfirm={() => deletingCategory && deleteMutation.mutate(deletingCategory.id)}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
