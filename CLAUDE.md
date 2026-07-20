# Project: LifeOS — Persian Life Management Platform

A backend-first platform (finance, tasks, habits, Jalali calendar, notes, analytics, AI) where the website is only Client #1. Android, iOS, desktop, Telegram, AI agents, MCP clients, and a public API must all consume the same backend without backend changes. See `~/.claude/plans/7-18-2026-11-25-pm-pouya-async-toast.md` for the original architecture validation and Phase 0/Auth build plan this repo was scaffolded from.

**Delivery sequence: local → git → VPS.** Everything is developed and verified against local Docker first. GitHub push (and CI) comes after local verification passes. Production VPS + Docker deploy (Stage C) has its artifacts written and locally verified as of 2026-07-20 — production Dockerfiles for `apps/web`/`apps/worker`, `docker-compose.prod.yml`, and a `deploy` job in `.github/workflows/ci.yml` — but is not yet live: no VPS has been provisioned. See `.claude/skills/deployment/SKILL.md` for exactly what's done vs. still blocked on provisioning.

**Architecture Decision Records** live in `docs/decisions/` — the structured "alternatives considered" reasoning behind the biggest calls (monolith vs. separate API, sync-ready vs. offline-first, VPS vs. Vercel, the auth token strategy, the module-resolution fix). This file documents the _what/how_; `docs/decisions/` documents the _why_, with rejected alternatives spelled out. Add a new ADR for any future decision that would be expensive to reverse.

---

## Architecture Rules (non-negotiable)

1. **No business logic in any client.** Derivation/calculation/aggregation/decisioning happens only in `packages/core`. Clients (web UI, and later Android/Telegram/MCP) fetch data, render UI, send commands. Formatting/presentation (date display, currency display, RTL) is a legitimate client concern; validation logic is shared via `packages/contracts` Zod schemas but the server is the authority.
2. **Single source of truth.** One implementation of every business rule, in `packages/core`. Every client hits the same `/api/v1` contract.
3. **Backend exposes APIs only.** Next.js Server Actions are allowed _only_ as thin adapters calling the same core services (form ergonomics) — never a second logic path. Every capability exposed via a Server Action must also exist as an `/api/v1` route.
4. **Reusable across every future client.** Before writing a feature, ask "can Android use this?" If the answer is no, redesign it.
5. **Modules are isolated** — each owns its API routes, Prisma models, services, and validation (see Finance/Tasks/Habits/etc. in the original spec).

These are enforced **mechanically**, not just by convention — see "Architecture Enforcement" below.

---

## Architecture Enforcement

`eslint.config.js` at the root defines `boundaries/elements` and `boundaries/element-types` rules (via `eslint-plugin-boundaries` + `eslint-import-resolver-typescript`) that make Rules 1/2/4 a lint failure, not just a convention:

| Element type | Path pattern                 | Allowed to import                                   |
| ------------ | ---------------------------- | --------------------------------------------------- |
| `contracts`  | `packages/contracts/src/**`  | `contracts` only                                    |
| `core`       | `packages/core/src/**`       | `contracts`, `core`, `db`                           |
| `db`         | `packages/db/src/**`         | `contracts`, `db`                                   |
| `web-routes` | `apps/web/src/app/api/**`    | `contracts`, `core`, `web-lib`, `web-routes`        |
| `web-app`    | `apps/web/src/app/**`        | `contracts`, `core`, `web-lib`, `web-app`, `web-ui` |
| `web-ui`     | `apps/web/src/components/**` | `contracts`, `web-ui`                               |
| `web-lib`    | `apps/web/src/lib/**`        | `contracts`, `core`, `web-lib`                      |
| `worker`     | `apps/worker/src/**`         | `contracts`, `core`, `worker`                       |

**Key implication: `apps/web` and `apps/worker` never import `@lifeos/db` directly.** Only `packages/core` does. Each core module that needs the database has one composition-root file (e.g. `packages/core/src/auth/container.ts`) that wires `@lifeos/db` repositories into services and exports ready-to-use singletons (e.g. `authService`). Web/worker import only the singleton. This is what "only core imports db" means in practice — don't add a db-importing helper anywhere under `apps/*`.

Verify the rule is live any time you touch `eslint.config.js`: create a throwaway file under `apps/web/src/components/` that imports `@lifeos/db`, run `npx eslint <file>`, confirm it errors, then delete the file.

---

## Monorepo Layout

npm workspaces, no Turborepo (kept simple — add it later only if build times demand it):

```
packages/
  contracts/   Zod schemas per module (auth/, common/) — the client contract. Also used for OpenAPI generation later.
  core/        Business logic, services, error hierarchy, logger. Zero Next.js imports. Only place @lifeos/db is imported.
  db/          Prisma schema + generated client + repository classes (each with an I*Repository interface for testability).
apps/
  web/         Next.js 16 App Router — UI + /api/v1/* route handlers (thin controllers only).
  worker/      BullMQ consumers + cron (placeholder — no real jobs yet, see Known Limitations).
```

Within `apps/web/src`:

- `app/[locale]/**` — localized UI pages (fa default, RTL; en secondary).
- `app/api/v1/**` — versioned REST routes, locale-agnostic, Bearer-token authenticated.
- `lib/route-handler.ts` — `runRoute()` wraps every route handler: generates a `requestId`, converts thrown errors via `@lifeos/core`'s `toErrorEnvelope`, forwards a typed `ctx` for dynamic segments.
- `lib/auth-context.ts` — `requireUser(req)` reads the `Authorization: Bearer` header and calls `authService.verifyAccessToken` (core does the actual verification).
- `proxy.ts` — Next.js 16's rename of `middleware.ts`. **Never add a `middleware.ts` alongside it** — Next 16 errors and breaks every build. Currently only runs next-intl's locale middleware; `/api/**` is excluded from its matcher (API auth is Bearer-token, not this gate).

---

## Module Pattern (established by Auth — copy this for every new module)

1. **Prisma schema**: sync-ready fields on every user-data model — `id` (uuid), `createdAt`, `updatedAt`, `deletedAt` (soft delete), `version`. This is what lets mobile/offline clients add delta sync later with zero backend changes (see "Sync-Ready Convention" below). `AuditLog` is append-only; every mutating service call writes one row.
2. **`packages/db/src/repositories/*.ts`**: one repository class per model, always paired with an `I*Repository` interface. The interface — not the concrete class — is what `packages/core` services depend on in their constructors. This is required for testability: TypeScript classes with `private` fields (e.g. `private readonly prisma`) are nominal, not structural, so a plain in-memory fake object cannot satisfy a concrete-class-typed constructor parameter. It can satisfy an interface.
3. **`packages/core/src/<module>/`**: `services/*.ts` (business rules, constructor-injected repositories), `ports/*.ts` (only for things that genuinely need a swappable adapter — e.g. `SmsProvider` — not for every dependency), `adapters/*.ts` (concrete port implementations, e.g. `MockSmsProvider`), `container.ts` (composition root — the only file that imports `@lifeos/db`).
4. **`packages/contracts/src/<module>/schemas.ts`**: Zod schemas for every request/response body. Route handlers call `Schema.parse(...)`; `ZodError` is caught centrally by `toErrorEnvelope` in `packages/core/src/http/response.ts` and turned into a `VALIDATION_ERROR` envelope — route handlers never catch `ZodError` themselves.
5. **`apps/web/src/app/api/v1/<module>/**/route.ts`**: thin — parse input via contracts, call the core service singleton, map the returned Prisma model to the contract's response shape (plain field mapping, not a generic serializer), return a plain object (or `NextResponse` for special cases) from the `runRoute()`-wrapped handler.
6. **Tests**: pure unit tests in `packages/core/tests/*.test.ts` using in-memory fakes typed against the `I*Repository` interfaces (see `otp-service.test.ts`, `session-service.test.ts` for the pattern) — fast, no Postgres needed. The full real-DB path is verified by driving the actual HTTP API with curl against the dockerized Postgres (see Verification below) rather than duplicating that as automated integration tests; add real integration tests here if a module's correctness genuinely depends on DB-specific behavior (constraints, transactions) that a fake can't exercise.

---

## Auth Module (reference implementation)

- **OTP-first, no passwords.** `POST /api/v1/auth/request-otp {phone}` → 6-digit code (crypto-random via `node:crypto.randomInt`, never `Math.random`), hashed with SHA-256 before storage, 5-minute expiry, 60-second resend cooldown, 5 max verify attempts before lockout. Delivered via `SmsProvider` interface — `MockSmsProvider` (default, logs the code) until a real Iranian provider (Kavenegar/SMS.ir) adapter is written; swapping providers touches only `packages/core/src/auth/adapters/`.
- **Access tokens are short-lived JWTs** (15 min, HS256 via `jose`, signed with `JWT_ACCESS_SECRET`). **Refresh tokens are opaque random strings** (`crypto.randomBytes(32).toString("base64url")`), never JWTs — only their SHA-256 hash is stored, which is what makes revocation possible (a JWT refresh token can't be invalidated before its own expiry). Refresh rotates the token on every use; reusing an old (rotated-away) refresh token fails immediately.
- **Session revocation takes effect immediately**, not after the access token's 15-minute expiry — `verifyAccessTokenAndSession` checks the session's `revokedAt` in the DB on every request, in addition to the JWT signature/expiry check. This is the deliberate defense-in-depth trade (one extra DB read per request) that makes logout/revoke actually work.
- **`GET/DELETE /api/v1/auth/sessions`** = device management (list + revoke), included from day one per the platform spec's Auth module requirements.
- Env: only `JWT_ACCESS_SECRET` is required (≥32 chars) — refresh tokens need no secret since they're opaque, not signed. Validated lazily via `packages/core/src/config/env.ts`'s `getEnv()` (memoized on first real use, not at import time — keeps unit tests from needing real secrets just to load a module).

---

## Sync-Ready Convention (not full offline-first)

The MVP is server-authoritative and online-first — **not** offline-first (that would put business logic on the client, violating Rule 1, and roughly doubles scope). But every user-data table carries `id`/`createdAt`/`updatedAt`/`deletedAt`/`version` (see `packages/contracts/src/common/sync.ts`'s `SyncFields` schema) so that when Android/iOS eventually need delta sync, it's a matter of adding cursor-based `updatedAt` list endpoints — no schema migration, no backend rework. Mutations on financial data should accept an `Idempotency-Key` header (not yet implemented — add when the Finance module lands).

---

## Money & Date Conventions (apply when Finance/Calendar modules are built)

- **Money**: `BigInt` minor units in IRR with an explicit `currency` column. Toman↔Rial is a _display-scale_ concern in the presentation layer only — never store or compute in floats, never store Toman as the base unit.
- **Dates**: store `timestamptz` (UTC) everywhere. Jalali/Gregorian conversion happens server-side (`jalaali-js` or `date-fns-jalali`, not yet installed) for aggregation boundaries (monthly budgets, weekly stats starting Saturday) — Jalali month boundaries are business logic, not just display. User profile should carry `timezone` (default `Asia/Tehran`) and a `calendar` preference.

---

## Stack

| Layer             | Technology                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework         | Next.js 16.2.9 — App Router, Turbopack                                                                                                                                     |
| Language          | TypeScript 5.7, strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)                                                                                          |
| Module resolution | `bundler` + `ESNext` **everywhere** (packages included) — see "Module Resolution Gotcha" below. Extensionless relative imports only; never add `.js` to a relative import. |
| Validation        | Zod v4 (top-level `z.uuid()`/`z.email()` API, not `z.string().uuid()`)                                                                                                     |
| Database          | PostgreSQL 16 (Docker locally) via Prisma 6.2.1 (deliberately not upgraded to 7 yet — see Known Limitations)                                                               |
| Cache/Queue       | Redis 7 (Docker locally), BullMQ (installed, not yet wired to real jobs)                                                                                                   |
| Auth              | OTP + short-lived JWT (`jose`) + opaque refresh tokens — see Auth Module above                                                                                             |
| i18n              | next-intl 4.13 — Farsi (`fa`, default, RTL) + English, `localeDetection: false`                                                                                            |
| Logging           | pino, module-level singleton, `base: null` (omit pid/hostname — noisy in single-container logs)                                                                            |
| Testing           | Node's built-in `node:test` + `tsx` loader — no vitest/jest                                                                                                                |
| Linting           | ESLint 9 flat config, `typescript-eslint`, `eslint-plugin-boundaries`                                                                                                      |

---

## Environment Constraints (Iran-specific — verified this session)

- **`registry.npmjs.org` is blocked** (curl times out). `.npmrc` at repo root points `registry` at `https://registry.npmmirror.com/` and sets `PRISMA_ENGINES_MIRROR` for Prisma's engine binary downloads. Confirmed working: `npm install` (442 packages) and `prisma generate`/`migrate dev` both succeed through the mirror.
- **The mirror lags npmjs slightly** — pin exact versions for anything with tight peer-dependency chains (React, Next, Prisma), use caret ranges for ESLint tooling (exact pins there caused real `ERESOLVE` conflicts between `typescript-eslint`'s bundled `@typescript-eslint/utils` and `eslint-import-resolver-typescript`'s peer requirement — fixed by bumping `typescript-eslint` to `^8.64.0`). If `npm install` fails with a confusing ERESOLVE that blames a version you didn't ask for, check whether `package-lock.json`/`node_modules` are stale from a previous attempt before assuming the range is wrong — a full `rm -rf node_modules package-lock.json && npm install` resolved a case where npm kept reusing a stale resolved tree despite an updated `package.json` range.
- **Docker Desktop does not auto-start** — `docker compose up` fails with `unable to get image ... dockerDesktopLinuxEngine` if it's not running. Launch it (`Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'`) and poll `docker info` until it succeeds (took ~10s this session) before running compose commands.
- Vercel CLI/MCP, `developers.google.com` (403s WebFetch), and Common Crawl's index API are blocked from this dev machine — same pattern as the sibling `pouyakarimi.ir` project, though not directly relevant here since this project targets VPS, not Vercel.

---

## Module Resolution Gotcha (cross-cutting — read before adding a package)

Every `tsconfig.json` in this repo (base + all packages/apps) uses `"module": "ESNext"` + `"moduleResolution": "bundler"`, **not** `NodeNext`. This was a deliberate fix, not the original choice: `packages/*` were initially `NodeNext` (which requires `.js` extensions on relative imports, e.g. `from "../errors/app-error.js"`, even though the source file is `.ts`). That works fine for standalone `tsc`/`tsx` execution, but **breaks when Next.js/Turbopack bundles the workspace packages' raw TS source** — Turbopack applies `apps/web`'s bundler-resolution rules to everything it processes, including `packages/core`/`db`/`contracts` source files, and bundler resolution doesn't understand the NodeNext `.js`-pointing-at-`.ts` convention. Symptom: `Module not found: Can't resolve './auth/container.js'` even though `container.ts` exists.

**Fix applied**: all packages switched to `bundler` resolution, all relative imports had their `.js` extensions stripped. If you add a new relative import anywhere in `packages/*` or `apps/*`, write it **without** an extension (`from "../errors/app-error"`, not `from "../errors/app-error.js"`). `tsx` and Turbopack both resolve extensionless imports correctly; NodeNext-style `.js` imports will silently work under plain `tsc`/`tsx` but break the Next.js build.

One related non-fatal Turbopack warning you'll see in `next dev` logs: `unexpected export * ... which is a CommonJS module with exports only available at runtime`, referring to `packages/db/generated/prisma/index.js` (Prisma 6.2.1's generated client is CJS). It's a warning, not a build failure — the auth API routes work correctly despite it (verified via the full curl flow). Don't try to silence it by restructuring the `@lifeos/db` barrel export; it's cosmetic.

---

## Testing

No vitest/jest — `node --import tsx --test "tests/**/*.test.ts"` per workspace (root `npm test` fans out via `--workspaces --if-present`). Each package/app's `tsconfig.json` includes `tests/**/*.ts` in addition to `src/**/*.ts` so test files are typechecked too (the `.claude` Stop hook and `npm run typecheck` both catch type errors in tests, not just source).

**Fakes over mocks for core services**: repositories are constructor-injected as their `I*Repository` interface, so tests pass plain in-memory objects (see `packages/core/tests/otp-service.test.ts`/`session-service.test.ts`) — no mocking library, no real Postgres needed for business-rule tests (cooldowns, attempt limits, token rotation, revocation). Type the fake's backing array against the real Prisma model type (`OtpCode[]`, not `any[]`) — ESLint's `@typescript-eslint/no-explicit-any` blocks `any` everywhere, tests included.

**End-to-end verification** for anything DB-dependent is a curl-driven pass against the real dockerized Postgres (`docker compose up -d` → `npm run dev` in `apps/web` → curl the actual routes), not a separate automated integration-test suite — this was how the whole auth flow (request-otp → verify-otp → me → list sessions → revoke → confirm 401 → refresh rotation → confirm old refresh token rejected → confirm `audit_logs` rows) was proven to work end-to-end this session. Re-run that same sequence after changing anything in the auth module.

---

## Database (Prisma 6.2.1 + local Docker Postgres)

**Connection**: `DATABASE_URL` env var (`postgresql://lifeos:lifeos_dev@localhost:5432/lifeos` for the docker-compose default). Each workspace that touches Prisma directly needs its own `.env` (Prisma CLI and Next.js both resolve `.env` relative to their own working directory, not the monorepo root) — `packages/db/.env` and `apps/web/.env` both exist and must stay in sync for `DATABASE_URL`.

**Migrations**: `cd packages/db && npx prisma migrate dev --name <description>`. Non-interactive shells can't confirm Prisma's "this looks risky" prompts — if a migration needs confirmation and you're certain it's safe on the (empty, local-only) dev database, use `prisma migrate reset --force` first, then re-run `migrate dev`. Never do this against a database with real data.

**Models** (auth module): `User` (phone-keyed, sync-ready fields), `OtpCode` (phone-keyed, not user-keyed — a phone can request an OTP before any account exists), `Session` (refresh-token-hash-keyed, sync-ready + revocation fields), `AuditLog` (append-only).

---

## Known Limitations / Deliberate Deferrals

- **Prisma stayed on 6.2.1**, not upgraded to the offered 7.x — it already works end-to-end (migrations, generation, the full auth flow) and Prisma 7 confirmed requires a driver-adapter pattern (`@prisma/adapter-pg`) plus a generator/output-path rename, not just a version bump. Upgrade deliberately in its own pass, not mid-scaffold, and re-verify the whole auth flow after — concrete step-by-step plan already written: `docs/prisma-7-migration-plan.md`.
- **`apps/worker` is a placeholder** — BullMQ/ioredis are installed but nothing is wired up yet (no real jobs exist until a module needs background processing, e.g. recurring transactions). Its `build` script (`tsc -p tsconfig.json`) emits real `.js` with extensionless relative imports, which **plain Node ESM cannot load directly** (Node's own ESM resolution requires explicit extensions, unlike bundler resolution). Before the worker has real logic and needs a production build, switch its build step to a bundler (`tsup`/`esbuild`) rather than raw `tsc` emit — don't discover this the hard way in a Docker build.
- **i18n is minimal** — `fa`/`en` routing, RTL, and a handful of login/home strings exist to prove the pattern; the message dictionaries need to grow with every new module's UI.
- **No rate limiting via Redis yet** despite Redis being provisioned — OTP request cooldown is currently DB-timestamp-based (good enough for MVP, not distributed-safe). Move to Redis-backed rate limiting before this needs to scale across multiple app instances.
- **No per-IP rate limiting on `/api/v1/auth/request-otp`** (found in security review) — the per-phone cooldown stops spamming _one_ number, but nothing stops one client from requesting OTPs for many _different_ numbers. Low-risk with the mock SMS adapter; becomes a real SMS-bombing/cost risk once a real provider (Kavenegar/SMS.ir) is wired in — add IP-based throttling (Redis) before that happens.
- **`ipAddress` on `Session` is client-suppliable** (`req.headers.get("x-forwarded-for")`, unvalidated) — spoofable by the caller, so it's a display-only field for the session/device-management UI, never a security decision input. Once behind a real reverse proxy (Stage C, likely Cloudflare), switch to the proxy-injected header (e.g. `CF-Connecting-IP`) that clients can't override.
- **Web client stores tokens in `localStorage`** (`apps/web/src/app/[locale]/login/page.tsx`) — necessary for now since the API is Bearer-token-only to stay identical across every client (mobile, Telegram, MCP), but it means an XSS bug on the web app would be able to read tokens directly. If the web client's XSS surface grows, consider layering an httpOnly-cookie session on top for the web app specifically (a Rule-3-compliant thin adapter) while every other client keeps using raw Bearer tokens.
- **SMS provider is mock-only** — logs the OTP code instead of sending it. Real delivery needs a Kavenegar/SMS.ir adapter implementing the existing `SmsProvider` interface; nothing else in the auth module should need to change.
- **No metrics/tracing/alerting infrastructure yet** (OpenTelemetry, Prometheus, etc.) — deliberately deferred, not an oversight. There's no deployed backend and no metrics/alerting backend to send data to yet (VPS deploy is Stage C), so adding an SDK now would be dead code with no consumer. What exists today: structured pino logs with stable `event` names (`auth.otp.requested`, `auth.login`, `auth.logout`, `auth.session.revoked`, mirroring the audit-log `action` strings) and a `requestId` correlation ID generated per request in `runRoute()`, returned via the `x-request-id` response header, and attached to error logs. Add real tracing/metrics once there's a production target to observe.
- **Notification dispatch (Reports & Notifications module) is synchronous, in-process, and best-effort** — see ADR-0009. Finance's `TransactionService` calls `NotificationService.create()` directly after its own write commits, wrapped in try/catch; a failure is logged and swallowed, never rolled back or retried. This is a deliberate stopgap forced by `apps/worker` still being a placeholder, and it's the template every future cross-module trigger (a Task-deadline reminder, an Auth new-device alert) should copy until the worker is production-ready — don't reach for BullMQ/an outbox table for a single trigger before that's true.

---

## Secret Hygiene

Same discipline as the sibling `pouyakarimi.ir` project, adapted for local-first development:

- **Secrets are env-only**, read via `process.env.*`. `.env.example` (root) holds variable names with empty values only. Real `.env` files exist per-workspace (`packages/db/.env`, `apps/web/.env`) and are gitignored (`.env*` with `!.env.example` in `.gitignore`).
- **`.githooks/pre-commit`** (installed via the root `package.json` `prepare` script → `git config core.hooksPath .githooks`) runs `lint-staged` (Prettier + `eslint --fix` on staged files) first, then blocks staged `.env`/`*.pem`/`*.key`/`*.local.sql` files and greps the staged diff for common secret token formats. The DSN pattern explicitly excludes `@localhost`/`@127.0.0.1` — the docker-compose dev credential (`lifeos:lifeos_dev@localhost`) legitimately appears in `.env.example` and `CLAUDE.md`, and a localhost-only connection string can never be a real leaked secret. Verified false positive on something else → `git commit --no-verify`.
- **`.githooks/pre-push`** runs the heavier gate before any push: full `lint` → `typecheck` → `test` → `format:check`, then a secret scan across every commit in the push range (diffed against the empty tree for a brand-new branch). Verified false positive → `git push --no-verify` (never to skip a real lint/test/type failure).
- **Claude Code git-guardrails hook** (`.claude/hooks/block-dangerous-git.mjs`, wired as a `PreToolUse` hook on `Bash` in `.claude/settings.json`) blocks Claude itself from running `git push`, `git reset --hard`, `git clean -f(d)`, `git branch -D`, or `git checkout .`/`git restore .` — a second, independent layer on top of the instruction-level git safety rules. Ported from the `git-guardrails-claude-code` skill to plain Node instead of its bundled `jq`-based bash script, since `jq` isn't installed in this environment.
- Since this repo hasn't been pushed to a remote yet, there's no "public git is forever" exposure — but treat the first push as the moment that changes, and audit history before it.

---

## Project-Local Skills (`.claude/skills/`)

LifeOS-specific skills, distinct from the generic global skill set — each is scoped to _this_ project's actual architecture, conventions, and history rather than being a generic checklist. Consult before the equivalent generic skill when one exists (e.g. `code-review` here before the generic `code-reviewer`, `security` here before `security-reviewer`) — the project-local version encodes decisions and gotchas the generic one has no way to know.

| Skill                                                              | Covers                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `verify`                                                           | Cold-start recipe for driving the auth API end-to-end against real Postgres           |
| `backend-architecture`                                             | Module Pattern build checklist for any new backend module                             |
| `lifeos-domain`                                                    | Jalali calendar, money (IRR/Toman), phone/SMS, and other Iran-specific business rules |
| `finance-module` / `task-module` / `ai-coach` / `mcp` / `telegram` | Build guidance for modules not started yet (Finance, Tasks, AI, MCP, Telegram)        |
| `nextjs-review`                                                    | Next.js 16 / Turbopack gotchas specific to this repo, already hit once each           |
| `code-review` / `testing` / `security` / `performance`             | This project's own architecture rules and known gaps, as review checklists            |
| `technical-seo` / `geo` / `article-review`                         | Scoped to the public/marketing surface only — never the authenticated app             |
| `deployment`                                                       | Stage C (VPS + Docker) — Dockerfiles/compose/deploy workflow ready, no VPS yet        |

---

## Continuous Project Knowledge

Maintain this file as a living knowledge base. When a significant task completes, a non-obvious problem gets solved, or an architectural decision is made, update the relevant section above (or add one) rather than letting that knowledge live only in conversation history. Prefer extending an existing section over creating a new one; keep entries concise and dated where the date matters (env/tooling facts especially — mirrors and registries drift).
