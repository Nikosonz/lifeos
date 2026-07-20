"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/utils";
import { notificationsApi } from "@/lib/notifications-api";
import { formatJalaliDate } from "@/lib/format-jalali";
import { toPersianDigits } from "@/lib/format-money";

export default function NotificationsPage() {
  const t = useTranslations("Notifications");
  const c = useTranslations("Common");
  const locale = useLocale() as "fa" | "en";
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery({
    queryKey: ["notifications", "list"],
    queryFn: ({ pageParam }) =>
      notificationsApi.list(pageParam !== undefined ? { cursor: pageParam } : {}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(c("save"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  // Every page response repeats the same current aggregate — the first
  // loaded page always exists once data arrives, and stays correct after a
  // ["notifications"] invalidation since that refetches every loaded page.
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          {unreadCount > 0 && (
            <Badge variant="secondary">
              {t("unreadCount", {
                count: locale === "fa" ? toPersianDigits(String(unreadCount)) : unreadCount,
              })}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllReadMutation.mutate()}
          disabled={unreadCount === 0 || markAllReadMutation.isPending}
        >
          <CheckCheck className="size-4" />
          {t("markAllRead")}
        </Button>
      </div>

      {!isPending && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      <div className="flex flex-col gap-2">
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => !n.readAt && markReadMutation.mutate(n.id)}
            className={cn(
              "flex w-full flex-col gap-1 rounded-md border p-3 text-start transition-colors",
              !n.readAt && "border-primary/40 bg-primary/5",
            )}
          >
            <div className="flex items-center gap-2">
              {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" />}
              <span className="font-medium">{n.title}</span>
            </div>
            <p className="text-sm text-muted-foreground">{n.body}</p>
            <span className="text-xs text-muted-foreground">
              {formatJalaliDate(n.createdAt, locale)}
            </span>
          </button>
        ))}
      </div>

      {hasNextPage && (
        <Button
          variant="outline"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="self-center"
        >
          {c("loadMore")}
        </Button>
      )}
    </div>
  );
}
