"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Monitor, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { settingsApi } from "@/lib/settings-api";
import { formatJalaliDate } from "@/lib/format-jalali";
import { ConfirmDeleteDialog } from "../_components/confirm-delete-dialog";
import { PageHelp } from "../_components/page-help";

// Web parity for two things mobile has had since its first release and web
// never did: an editable display name (Phase 6 added User.name) and device
// management over the sessions API that has existed since the auth module
// shipped. Both are plain compositions of existing endpoints — no new
// backend surface.
export default function SettingsPage() {
  const t = useTranslations("Settings");
  const { locale } = useParams<{ locale: string }>();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [calendarPreference, setCalendarPreference] = useState<"JALALI" | "GREGORIAN">("JALALI");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => settingsApi.me() });
  const { data: sessionData } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => settingsApi.listSessions(),
  });

  // Seeded from the server exactly once per fetched profile, not on every
  // render — depending on `me` alone (not a derived object) is the same
  // rule CLAUDE.md documents for dialog reset effects: a broader dependency
  // would wipe whatever the user had already typed on any background
  // refetch.
  useEffect(() => {
    if (!me) return;
    setName(me.name ?? "");
    setTimezone(me.timezone);
    setCalendarPreference(me.calendarPreference);
  }, [me]);

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateProfile({
        // An emptied field clears the name rather than being skipped —
        // UpdateProfileInput.name is .nullable().optional() precisely so
        // "remove my name" is expressible, unlike Calendar's description.
        name: name.trim() === "" ? null : name.trim(),
        timezone,
        calendarPreference,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success(t("saved"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setRevokingId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sessions = sessionData?.sessions ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-1">
        <h1 className="border-brand-lapis border-s-4 ps-3 text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <PageHelp pageKey="settings" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profileSection")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input
              id="name"
              maxLength={80}
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="text-muted-foreground flex flex-col gap-1 text-sm">
            <span>
              {t("phoneLabel")}: {me?.phone ?? t("notSet")}
            </span>
            <span>
              {t("emailLabel")}: {me?.email ?? t("notSet")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("preferencesSection")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="timezone">{t("timezoneLabel")}</Label>
            <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="calendar">{t("calendarLabel")}</Label>
            <Select
              value={calendarPreference}
              onValueChange={(v) => setCalendarPreference(v as "JALALI" | "GREGORIAN")}
            >
              <SelectTrigger id="calendar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JALALI">{t("calendarJalali")}</SelectItem>
                <SelectItem value="GREGORIAN">{t("calendarGregorian")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="self-start"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {t("save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("devicesSection")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t("devicesDescription")}</p>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noSessions")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Monitor className="text-muted-foreground size-4 shrink-0" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{s.userAgent ?? t("unknownDevice")}</span>
                      <span className="text-muted-foreground text-xs">
                        {t("lastUsed")}:{" "}
                        {formatJalaliDate(s.lastUsedAt, locale === "fa" ? "fa" : "en")}
                        {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive shrink-0"
                    onClick={() => setRevokingId(s.id)}
                  >
                    {t("revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("privacySection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href={`/${locale}/privacy`}
            className="inline-flex items-center gap-2 text-sm underline underline-offset-2"
          >
            <ShieldCheck className="size-4" />
            {t("privacyLink")}
          </Link>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={revokingId !== null}
        onOpenChange={(open) => !open && setRevokingId(null)}
        pending={revokeMutation.isPending}
        onConfirm={() => revokingId && revokeMutation.mutate(revokingId)}
      />
    </div>
  );
}
