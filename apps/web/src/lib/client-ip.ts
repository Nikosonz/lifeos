import type { NextRequest } from "next/server";
import { getEnv } from "@lifeos/core";

// Reading an IP off request headers is HTTP plumbing, so it lives here
// rather than in core — same split as auth-context.ts, which reads the
// Authorization header here but leaves token verification to core.
//
// **How much this can be trusted, precisely.** CLAUDE.md already documents
// that `x-forwarded-for` is client-suppliable and must never be a security
// decision input. Rate limiting *is* a security decision input, so the
// honest position is:
//
//   - With TRUSTED_PROXY_IP_HEADER set (Stage C, Cloudflare →
//     "cf-connecting-ip"), the value comes from a proxy that overwrites
//     the header, and a client cannot forge it. Then this is real.
//   - Unset — today, with docker-compose.prod.yml publishing port 3000
//     directly and no proxy anywhere — there is no trustworthy source, so
//     this falls back to x-forwarded-for and the per-IP limits become
//     best-effort: they stop naive scripted abuse and runaway retry loops,
//     and a determined attacker rotating the header walks straight past
//     them.
//
// That is a real, known gap, not a claim of protection. It closes when a
// proxy lands, which is why the header is configurable rather than
// hardcoded. The per-identifier OTP cooldown, which is *not* spoofable
// (the identifier is the thing being protected), is what actually holds
// the line until then.
export function clientIpFromRequest(req: NextRequest): string {
  const trustedHeader = getEnv().TRUSTED_PROXY_IP_HEADER;
  if (trustedHeader) {
    const value = req.headers.get(trustedHeader)?.trim();
    // No fallback when a trusted header is configured but absent: that
    // means the request bypassed the proxy, and honouring x-forwarded-for
    // there would hand every client a trivial way to opt out of limits.
    if (value) return value;
    return "unknown";
  }

  // x-forwarded-for is a comma-separated chain; the leftmost entry is the
  // originating client as reported by the first proxy. Untrusted here (see
  // above), used only because it's the best signal available.
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "unknown";
}
