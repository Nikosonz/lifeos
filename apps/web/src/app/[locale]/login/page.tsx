"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setTokens } from "@/lib/token-store";

// Thin client component: collects input, calls the API, stores the tokens
// it's handed back, and renders whatever the API says. No OTP generation,
// no token verification, no business logic happens here — see CLAUDE.md
// Rule 1. Every other client (Android, Telegram, MCP) hits the exact same
// /api/v1/auth/* endpoints.
//
// Restyled but behaviorally identical to the original: apps/web/e2e/
// login.spec.ts hardcodes getByLabel("شماره موبایل"/"کد تایید") and
// getByRole("button", {name: "دریافت کد"/"ورود"}) — those are fa.json's
// Login.* translation VALUES, unchanged here, so real <Label htmlFor>/
// <Input id> pairing and shadcn's real-<button>-rendering Button keep the
// exact same accessible names. The error message intentionally stays a
// plain <p> (no role="alert") — Next's own route-announcer div also
// carries role="alert", which the e2e test's own comment already
// documents as a trap; only the Tailwind classes changed there.
export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
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

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/v1/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
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
        body: JSON.stringify({ phone, code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message ?? "Verification failed");
      setTokens(body.tokens.accessToken, body.tokens.refreshToken);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">LifeOS</CardTitle>
          <CardDescription>{t("phoneLabel")}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "done" && <p className="text-sm font-medium">{t("success")}</p>}

          {step === "phone" && (
            <form onSubmit={requestCode} className="flex flex-col gap-4">
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
              <Button type="submit" disabled={pending}>
                {t("requestCode")}
              </Button>
            </form>
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
              <Button type="button" variant="ghost" onClick={() => setStep("phone")}>
                {t("resend")}
              </Button>
            </form>
          )}

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
