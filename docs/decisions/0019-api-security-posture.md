# ADR-0019: Security headers yes, permissive CORS deliberately no

## Status

Accepted

## Date

2026-07-27

## Context

A security-hardening pass on `apps/web`'s `/api/v1` surface (`docs/roadmap.md` Phase 5)
found two related but distinct gaps while auditing what's already in place:

- **Zero security headers are emitted at any layer.** `next.config.mjs` has no `headers()`
  function; `proxy.ts`'s matcher explicitly excludes `/api` (`"/((?!api|_next|.*\\..*).*)"`,
  with a comment confirming it's intentional — API auth is Bearer-token-based, not a
  middleware concern); `docker-compose.prod.yml` has no reverse-proxy/ingress service in
  front of `web` (it publishes port 3000 directly). There is no layer currently capable of
  adding `Content-Security-Policy`, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, or `X-Frame-Options`.
- **Zero CORS configuration exists** — no `Access-Control-*` headers on any route, no
  `OPTIONS`/preflight handler.

The second gap looks like an obvious omission next to the first, but auditing the actual
callers shows it isn't:

- `apps/web`'s own frontend calls `/api/v1` with **root-relative paths**
  (`apps/web/src/lib/api-client.ts` — `fetch(url, ...)` where `url` is always a literal
  like `/api/v1/finance/wallets`, never an absolute URL). Same-origin by construction; CORS
  never engages.
- The Flutter mobile client is a **native Dio HTTP client**, not a browser — there is no
  `mobile/web/` platform target in this Flutter project (only `android/` and `windows/`),
  so there is no browser context for CORS to apply to. The client's own code comment
  confirms this: `// Windows desktop uses dart:io (no CORS), so it can hit localhost
directly.`
- `apps/worker` makes no HTTP calls to `/api/v1` at all (it's currently a one-line
  placeholder per CLAUDE.md's Known Limitations).

**There is no browser-cross-origin caller of `/api/v1` today.**

## Decision

Add security headers. **Do not add CORS configuration.**

- `apps/web/next.config.mjs` gains a `headers()` function applying CSP, HSTS,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy`, and `X-Frame-Options: DENY` to all routes (including `/api/v1`,
  since Next's `headers()` config applies independently of `proxy.ts`'s middleware matcher).
- No `Access-Control-*` headers, no `OPTIONS` handlers, added anywhere. The absence is a
  decision, not an oversight — this file exists so a future session doesn't "fix" it by
  adding permissive CORS without first checking whether the underlying premise (no browser
  caller) has changed.

## Alternatives Considered

### Permissive CORS now, "just in case"

- Pros: Removes the class of question "does the app work if someone builds a browser
  client against this API" before it's ever asked.
- Cons: Adding `Access-Control-Allow-Origin: *` (or any origin allowlist) to an API that
  currently has zero legitimate browser callers is a straightforward net negative — it
  widens the attack surface (a malicious page could drive authenticated requests from a
  victim's browser if they ever had a token accessible to JS, which — per CLAUDE.md's
  documented XSS/localStorage trade-off for the web client — they do) for a capability
  nothing in the product uses.
- Rejected: speculative flexibility with a real, present-day security cost and no current
  consumer — the same "don't design for hypothetical future requirements" principle this
  project already applies elsewhere (see `docs/decisions/0009-in-process-notification-dispatch.md`'s
  rejection of building an event bus before there's a second consumer).

### Restrictive CORS scoped to a known origin (e.g. only the production web domain)

- Pros: Would be the correct move if the web frontend ever called the API cross-origin
  (e.g. a separately-hosted static frontend, or a future Vercel deploy of just the UI).
- Cons: Not needed today — the web frontend is same-origin by construction, and changing
  that architecture is a bigger decision than this ADR's scope.
- Rejected for now: not a rejection of the idea, just premature. See Consequences for the
  exact trigger that should prompt revisiting this.

## Consequences

- `apps/web`'s API remains same-origin-only in practice. If a browser-based third-party
  client, a separately-hosted frontend, or a Flutter **web** build target is ever added,
  **this ADR must be revisited before that client can call `/api/v1`** — it will fail with
  CORS errors by design, and that failure is the correct signal to come back here rather
  than silently opening CORS as a bug-fix reflex.
- Security headers apply to every response, including error envelopes from `runRoute`'s
  catch path. **Verified 2026-07-28** (this ADR's own follow-up): the full set is present on
  a `200` from `/api/v1/auth/request-otp` in dev, and on a `400` error envelope from a real
  production build — so the catch path is genuinely covered, not just the happy path.
  Production additionally emits HSTS and CSP's `upgrade-insecure-requests`, and drops
  `unsafe-eval`; all three are `NODE_ENV`-branched at build time in `next.config.mjs`.
- No proxy/ingress layer exists yet for Stage C (VPS deploy). When one is added (per
  `docs/decisions/0003-vps-docker-hosting.md`'s Cloudflare-fronted target), it may
  duplicate or override some of these headers (HSTS in particular is often proxy-owned) —
  reconcile at that point rather than assuming today's `next.config.mjs` headers are the
  final word once a real reverse proxy exists.
