"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MeResponse } from "@lifeos/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import { setTokens } from "@/lib/token-store";
import { brandName } from "@/lib/brand";

type Channel = "phone" | "email";

// Thin client component: collects input, calls the API, stores the tokens
// it's handed back, and renders whatever the API says. No OTP generation,
// no token verification, no business logic happens here — see CLAUDE.md
// Rule 1. Every other client (Android, Telegram, MCP) hits the exact same
// /api/v1/auth/* endpoints.
//
// apps/web/e2e/login.spec.ts hardcodes getByLabel("شماره موبایل"/"کد
// تایید") and getByRole("button", {name: "دریافت کد"/"ورود"}) — those are
// fa.json's Login.* translation VALUES. The default channel is EMAIL: it is
// the only one with a real provider, so a phone request 400s in production.
// The phone specs therefore click the channel toggle first. The error
// message intentionally stays a plain <p> (no role="alert") — Next's own
// route-announcer div also carries role="alert", already documented as a
// trap by the pre-existing e2e test.
export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  // Email, not phone: MockSmsProvider refuses to run in production, so a
  // phone request is a 400 there ("ورود با شماره موبایل هنوز فعال نیست").
  // The phone toggle stays — it works locally with DEV_OTP_CODE, and this
  // is a one-word change back the day a Kavenegar adapter lands.
  const [channel, setChannel] = useState<Channel>("email");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"identifier" | "code" | "name" | "done">("identifier");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // A brief, deliberate delay rather than an immediate redirect: long
  // enough that a real user sees the success confirmation (and that
  // apps/web/e2e/login.spec.ts's assertion — which runs essentially
  // immediately after the click — reliably observes the text before
  // navigation ever starts), short enough not to feel like a stall.
  useEffect(() => {
    if (step !== "done") return;
    const timer = setTimeout(() => router.replace(`/${locale}/finance`), 700);
    return () => clearTimeout(timer);
  }, [step, router, locale]);

  function identifierBody() {
    return channel === "phone" ? { phone } : { email };
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/v1/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(identifierBody()),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message ?? "Request failed");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...identifierBody(), code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message ?? "Verification failed");
      setTokens(body.tokens.accessToken, body.tokens.refreshToken);
      // The one thing the API previously could not tell a client apart:
      // a brand-new account vs. a returning login (see ADR-0018). Only a
      // genuinely new account gets asked for a name, and even then it's
      // skippable — User.name is nullable precisely so this can be.
      setStep(body.isNewUser ? "name" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setPending(false);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      // Authenticated, unlike the two calls above — apiFetch attaches the
      // Bearer token just stored by verifyCode and validates the response
      // against the same contract schema the server maps its output to.
      await apiFetch("/api/v1/me", { method: "PATCH", body: { name }, schema: MeResponse });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save name");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="bg-muted/30 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {step === "name" ? t("nameTitle") : brandName(locale)}
          </CardTitle>
          <CardDescription>
            {step === "name"
              ? t("nameDescription")
              : channel === "phone"
                ? t("phoneLabel")
                : t("emailLabel")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "done" && <p className="text-sm font-medium">{t("success")}</p>}

          {step === "identifier" && (
            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center gap-1 self-start rounded-md border p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={channel === "phone" ? "secondary" : "ghost"}
                  onClick={() => setChannel("phone")}
                >
                  {t("channelPhone")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={channel === "email" ? "secondary" : "ghost"}
                  onClick={() => setChannel("email")}
                >
                  {t("channelEmail")}
                </Button>
              </div>

              <form onSubmit={requestCode} className="flex flex-col gap-4">
                {channel === "phone" ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone">{t("phoneLabel")}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      placeholder={t("phonePlaceholder")}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">{t("emailLabel")}</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                )}
                <Button type="submit" disabled={pending}>
                  {t("requestCode")}
                </Button>
              </form>
            </div>
          )}

          {step === "code" && (
            <form onSubmit={verifyCode} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">{t("codeLabel")}</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={pending}>
                {t("verifyCode")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("identifier")}>
                {t("resend")}
              </Button>
            </form>
          )}

          {step === "name" && (
            <form onSubmit={saveName} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t("nameLabel")}</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  maxLength={80}
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={pending}>
                {t("saveName")}
              </Button>
              {/* Skipping is a first-class outcome, not a dead end: the
                  account already exists by this point, so this button
                  just moves on without a PATCH. */}
              <Button type="button" variant="ghost" onClick={() => setStep("done")}>
                {t("skipName")}
              </Button>
            </form>
          )}

          {/* Shown for the whole pre-account portion of the flow, since
              the account is created the moment the code is verified —
              notice has to precede that, not follow it. */}
          {(step === "identifier" || step === "code") && (
            <p className="text-muted-foreground mt-4 text-xs">
              {t.rich("consent", {
                privacy: (chunks) => (
                  <Link href={`/${locale}/privacy`} className="underline underline-offset-2">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          )}

          {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
