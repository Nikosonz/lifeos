---
name: deployment
description: Use when planning or building Stage C (VPS + Docker production deploy) — not built yet. Everything so far has been Stage A (local). Read this before writing a production Dockerfile, prod compose file, or deploy workflow so Stage A's dev-only shortcuts don't leak into production.
---

# Deploying LifeOS (Stage C — not built yet)

Per CLAUDE.md's delivery sequence (local → git → VPS) and ADR-0003, this
is the third and final stage, deliberately not started. Stage A (local
Docker) and Stage B (GitHub push + CI) are done. This skill is the
checklist for when Stage C actually starts, so dev-only shortcuts from
Stage A don't silently become production configuration.

## Target (per ADR-0003)

VPS (e.g. Hetzner) behind Cloudflare, `docker-compose` running Postgres,
Redis, the Next.js app, and the worker. GitHub Actions handles CI already
(`.github/workflows/ci.yml`) and will handle SSH-based deploy — not yet
wired up.

## Dev-only things that must NOT ship as-is

- **`docker-compose.yml`'s Postgres/Redis credentials**
  (`lifeos`/`lifeos_dev`) are dev-only, deliberately simple, and
  documented as safe to expose (see the `security` skill's note on the
  secret-scanner's localhost exclusion). Production needs real generated
  secrets, provisioned via GitHub Actions Secrets or the VPS's own secret
  store — never committed, never reused from `.env.example`.
- **`JWT_ACCESS_SECRET`** needs a real, freshly generated production value
  — never the placeholder used in local `.env` files or CI's
  build-time placeholder (`ci-build-placeholder-secret-at-least-32-chars`
  in `.github/workflows/ci.yml` — that one exists only so `next build`
  has _a_ syntactically valid secret, it must never be the runtime value).
- **`x-forwarded-for`-based `ipAddress`** (see `security` skill) — once
  Cloudflare is actually in front of the app, switch to trusting
  Cloudflare's own client-IP header instead of the raw, spoofable
  `X-Forwarded-For`.
- **`apps/worker`'s build step** (`tsc -p tsconfig.json`, per ADR-0005's
  consequences) emits extensionless-import `.js` that plain Node ESM
  can't load. Switch to `tsup`/`esbuild` for the worker's production
  build _before_ it needs to run in a container — don't discover this
  inside a Docker build.

## Prisma in production

- Migrations: `prisma migrate deploy` (non-interactive, safe for CI/CD),
  never `migrate dev` against a production database.
- The `linux-musl-openssl-3.0.x` binary target already in
  `packages/db/prisma/schema.prisma` exists specifically so an
  Alpine-based production image needs no client regeneration — verify
  this assumption still holds against whatever base image the production
  Dockerfile actually uses.
- Revisit whether Prisma 7 (`docs/prisma-7-migration-plan.md`) should
  happen _before_ or _after_ Stage C — either order is defensible, but
  don't let the Prisma major-version upgrade and the first production
  deploy happen in the same change; isolate variables.

## What doesn't need to change

- The monolith/module-boundary architecture (ADR-0001) — nothing about
  going to production changes how `apps/web`/`apps/worker` relate to
  `packages/*`.
- The auth token strategy (ADR-0004) — no cookie-based session needed
  for the API itself; TLS termination at Cloudflare/the VPS is what makes
  Bearer-token-over-HTTPS acceptable in production (verify HTTPS is
  actually enforced end-to-end before shipping, not just at Cloudflare's
  edge).

## First deploy checklist (fill in as Stage C actually happens)

1. Provision the VPS, install Docker, configure Cloudflare.
2. Write production `Dockerfile`s for `apps/web` and `apps/worker`
   (multi-stage, `prisma generate` + `next build` / worker bundle).
3. Write a production `docker-compose.prod.yml` (or equivalent) —
   separate from the dev `docker-compose.yml`, real secrets via env
   injection, no bind-mounted source.
4. Extend `.github/workflows/ci.yml` (or add a new workflow) with an
   SSH-deploy job gated on `main` + CI passing.
5. Re-run the full verify sequence (`.claude/skills/verify/SKILL.md`)
   against the deployed instance, not just locally.
6. Update CLAUDE.md's delivery-sequence note once Stage C is live —
   it currently says "not yet built."
