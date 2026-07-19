"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Thin client component: collects input, calls the API, stores the tokens
// it's handed back, and renders whatever the API says. No OTP generation,
// no token verification, no business logic happens here — see CLAUDE.md
// Rule 1. Every other client (Android, Telegram, MCP) hits the exact same
// /api/v1/auth/* endpoints.
export default function LoginPage() {
  const t = useTranslations("Login");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      localStorage.setItem("accessToken", body.tokens.accessToken);
      localStorage.setItem("refreshToken", body.tokens.refreshToken);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setPending(false);
    }
  }

  if (step === "done") {
    return <p>{t("success")}</p>;
  }

  return (
    <main>
      {step === "phone" && (
        <form onSubmit={requestCode}>
          <label>
            {t("phoneLabel")}
            <input
              type="tel"
              required
              placeholder={t("phonePlaceholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button type="submit" disabled={pending}>
            {t("requestCode")}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verifyCode}>
          <label>
            {t("codeLabel")}
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button type="submit" disabled={pending}>
            {t("verifyCode")}
          </button>
          <button type="button" onClick={() => setStep("phone")}>
            {t("resend")}
          </button>
        </form>
      )}

      {error && <p role="alert">{error}</p>}
    </main>
  );
}
