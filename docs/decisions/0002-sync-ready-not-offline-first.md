# ADR-0002: Sync-ready schema, not offline-first, for the MVP

## Status

Accepted

## Date

2026-07-18

## Context

The original platform spec listed "Offline Sync Architecture" as P0. True offline-first requires local writes and client-side conflict resolution — business logic on the client, which directly violates Rule 1 (no business logic in any client) and roughly doubles MVP scope (a replicated domain layer per client platform).

## Decision

MVP is server-authoritative and online-first. Every user-data Prisma model carries `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (soft delete), and `version` (see `packages/contracts/src/common/sync.ts`'s `SyncFields`). This is enough for a future mobile client to add cursor-based delta sync (`GET /resource?cursor=<updatedAt>`) with zero schema migration and zero backend rework — but no offline write path exists yet.

## Alternatives Considered

### Full offline-first in P0 (local-first storage + sync engine from day one)

- Pros: Matches the original spec literally; Android/iOS could work without a network from the start.
- Cons: Requires a client-side domain/business-logic layer to resolve conflicts (violates Rule 1), no client platforms exist yet to build it for, and it front-loads sync-engine complexity before there's a single working module to sync.
- Rejected: Premature — there is no mobile client to offline-enable yet. Revisit when Android/iOS work actually starts (P2 per the roadmap).

### No sync-readiness at all (plain models, add sync fields later if needed)

- Pros: Marginally less schema ceremony now.
- Rejected: Retrofitting `version`/`deletedAt` onto tables with real user data later is a real migration, not a free change. The columns are nearly free to add now (every table needs `createdAt`/`updatedAt` anyway) and defer the expensive part (the actual sync engine) indefinitely.

## Consequences

- Every new module's Prisma models must follow the sync-ready convention from day one (see CLAUDE.md Module Pattern step 1) — this is now a mechanical checklist item, not a judgment call per module.
- Idempotency-Key handling for financial mutations is deferred until the Finance module lands (documented in CLAUDE.md, not yet implemented).
- List/read endpoints should be designed as cursor-paginated by `updatedAt` from the start (`packages/contracts/src/common/pagination.ts`) so the same shape later serves both "page 2" and "what changed since I last synced."
