# ADR-0007: Postgres table (not Redis) for idempotency keys

## Status

Accepted

## Date

2026-07-19

## Context

`packages/contracts/src/common/sync.ts` has carried an `IdempotencyKeyHeader` schema since the Auth-module scaffold, but nothing ever implemented the mechanism it implies. The Finance module is the first to need it for real: CLAUDE.md's Sync-Ready Convention calls for financial mutations to accept an `Idempotency-Key` header, and the `finance-module` skill is explicit that a duplicated financial transaction (e.g. from a client retrying a timed-out request) is a real user-facing bug, not a cosmetic one.

## Decision

A new, shared `IdempotencyKey` Postgres table (`packages/db/prisma/schema.prisma`), unique on `(userId, key)`, with `resourceType`/`resourceId` columns pointing at whatever row the mutation produced. `FinanceTransactionRepository.createWithIdempotency`/`updateWithIdempotency` insert the resource row and the idempotency-key row inside a single Prisma interactive transaction (`prisma.$transaction`) — a unique-constraint violation on the key rolls back the entire transaction, so a losing concurrent request never leaves a duplicate or orphaned resource row behind. `TransactionService` owns the decision logic on top: a replay (same key, same request hash) returns the existing resource with no new write; a reused key with a different request hash is a `409 Conflict`, not a silent wrong answer.

Scoped to `POST`/`PATCH /transactions` only for this pass — the `finance-module` skill's only explicit callout ("create/update transaction"); `RecurringPayment`'s eventual "apply payment" idempotency is deferred along with the rest of that model.

## Alternatives Considered

### Redis, keyed on `userId:key` with a TTL

- Pros: Native key expiry (no manual cleanup job needed); Redis is already provisioned in `docker-compose.yml`.
- Cons: Redis has zero real consumers anywhere in this codebase today — the OTP-request cooldown (the one place rate-limiting-like logic already exists) is deliberately still DB-timestamp-based for the same reason (CLAUDE.md's Known Limitations: "good enough for MVP, not distributed-safe"). More fundamentally, a Redis-based key store can't participate in the same ACID transaction as the actual Postgres resource write — the Postgres write could succeed while the Redis write fails (or vice versa), reintroducing a distributed-transaction problem that a single-database transaction avoids entirely by construction.
- Rejected: no measured latency need justifies introducing Redis's first real usage for a low-volume, non-hot-path check, especially when it would trade away the atomicity a same-database transaction gives for free.

### No idempotency layer; rely on client-side retry discipline

- Rejected outright per the `finance-module` skill: a duplicated financial transaction is a real bug, not an acceptable risk to defer.

## Consequences

- This establishes the pattern for any future module needing idempotent mutations (e.g. `RecurringPayment`'s "apply payment" once `apps/worker` is production-ready, per CLAUDE.md's Known Limitations) — they should extend the same shared `IdempotencyKey` table via its `resourceType` discriminator rather than each inventing a per-module mechanism.
- TTL/cleanup (e.g. deleting rows older than some retention window) is a simple periodic delete, deferred until a real cron/worker job exists — not solved by Redis's native expiry, since that tradeoff was deliberately declined above.
- If Redis-backed rate limiting is ever built (CLAUDE.md's Known Limitations already flags this as needed before a real SMS provider goes live), that's a different, genuinely distributed-cache-shaped problem (request-rate counters, not exactly-once resource creation) — it doesn't retroactively argue for moving idempotency keys to Redis too.
