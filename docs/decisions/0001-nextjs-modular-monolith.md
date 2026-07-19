# ADR-0001: Next.js modular monolith over a separate API service

## Status

Accepted

## Date

2026-07-18

## Context

LifeOS must serve seven planned clients (web, Android, iOS, desktop, Telegram, AI agents, public API) from one backend with zero backend changes per new client (see CLAUDE.md Architecture Rules 2 and 4). The original spec listed Next.js Server Actions alongside API routes, which is internally contradictory: Server Actions are a Next.js-private RPC mechanism — Android, Telegram, and MCP clients cannot call them. Something had to give.

## Decision

One Next.js app (`apps/web`) hosts both the UI and the entire `/api/v1/*` surface. All business logic lives in framework-agnostic `packages/core`; route handlers are thin controllers. Server Actions are permitted only as adapters that call the same core services Next.js route handlers call — never a second logic path — and every capability exposed via a Server Action must also exist as an `/api/v1` route.

## Alternatives Considered

### Separate API service (`apps/api`, e.g. NestJS/Fastify) + Next.js as pure Client #1

- Pros: Cleanest possible enforcement of "web is just a client" — Next.js would call its own API over HTTP exactly like Android will.
- Cons: A second framework, a second deploy target, HTTP round-trips for the web app's own reads, more infra to run locally and on the VPS, slower iteration for a small team.
- Rejected: The lint-enforced import boundaries (see CLAUDE.md "Architecture Enforcement") achieve the same guarantee — no business logic reachable outside `packages/core` — without the operational cost of a second service. Revisit if `apps/web` ever needs to scale independently from the API surface.

### Server Actions as the primary mutation path (spec's original framing)

- Rejected outright: fails Rule 4 immediately. A Telegram bot or MCP client cannot invoke a Server Action.

## Consequences

- `apps/web` and `apps/worker` never import `@lifeos/db` directly — only `packages/core` does — enforced by `eslint-plugin-boundaries` (ADR-0005 covers the module-resolution mechanics that make this bundling work).
- Every new module (Finance, Tasks, ...) must ship its API routes and its core services together, per the Module Pattern in CLAUDE.md.
- RSC pages may call core services directly for reads (avoids a self-HTTP round-trip), but the same capability must still exist as a versioned route for other clients.
