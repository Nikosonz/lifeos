# ADR-0003: VPS + Docker hosting over Vercel or Iranian cloud

## Status

Accepted

## Date

2026-07-18

## Context

LifeOS needs Postgres, Redis, a Next.js app, and a background-job worker (BullMQ) running continuously. The developer is based in Iran; the sibling `pouyakarimi.ir` project (same developer) has already documented that Vercel's CLI/MCP are blocked from Iran, and that npm's default registry is blocked and requires a mirror workaround — both real, verified constraints, not hypothetical ones.

## Decision

Target a VPS (e.g. Hetzner) behind Cloudflare, running Postgres, Redis, the Next.js app, and the worker via `docker-compose`, for both local development and eventual production. GitHub Actions (whose runners sit outside Iran and are unaffected by the local network restrictions) will handle CI and, later, SSH-based deploy to the VPS.

## Alternatives Considered

### Vercel + managed services (Neon Postgres, Upstash Redis)

- Pros: Excellent DX, zero server management, matches the sibling portfolio project's stack.
- Cons: No long-running process for BullMQ workers (serverless functions can't host a persistent queue consumer — would need QStash or similar workaround); Vercel's dashboard/CLI already confirmed unreliable from this developer's network for the sibling project.
- Rejected: The worker requirement alone rules this out cleanly; the Iran-network history makes it a worse bet than a VPS the developer fully controls.

### Iranian cloud (ArvanCloud, ParsPack, etc.)

- Pros: Best latency and data residency for an Iran-based user population; likely the most reliable network path for local users.
- Cons: Fewer managed services (would still self-host most of the stack), less proven from this exact developer environment than a generic VPS + Docker approach.
- Not rejected outright — a plausible **production** choice once the platform has real users and residency/latency matters more than it does at the Phase 0/1 stage. Deferred rather than decided against; revisit at the Stage C (VPS) deploy planning session.

## Consequences

- `docker-compose.yml` (dev) uses plain `postgres:16-alpine` / `redis:7-alpine` — no cloud-specific driver adapters (e.g. no `@prisma/adapter-pg` for Neon's serverless driver, unlike the sibling project).
- The Prisma schema's `binaryTargets` includes `linux-musl-openssl-3.0.x` specifically so the eventual Alpine-based production Docker image needs no client regeneration.
- Deploy is a later, separate phase (Stage C) — not yet built. This ADR fixes the _target_, not the deploy mechanics.
