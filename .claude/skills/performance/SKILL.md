---
name: performance
description: Use when a query, endpoint, or page is measurably slow, or when reviewing a change likely to introduce N+1 queries or unbounded result sets. LifeOS has no production traffic yet — this is about not building obvious footguns, not premature optimization.
---

# Performance guidance for LifeOS

No production deployment and no measured slowness exists yet (Stage C
isn't built). This is deliberately not a full performance-monitoring
skill (see `observability-and-instrumentation` for why metrics/tracing
are explicitly deferred until there's a production target). What follows
is the cheap-to-apply-now checklist that prevents obvious problems,
not a premature-optimization exercise.

## Prisma query patterns to watch for

- **N+1 queries**: fetching a list then looping to fetch each item's
  relation individually. Use Prisma's `include`/`select` to fetch
  relations in the same query. This will matter the moment Finance
  (transactions with categories) or Tasks (tasks with subtasks/labels)
  ship — watch for it from their first service, not after a slowdown is
  measured.
- **Unbounded list endpoints**: every list endpoint should be
  cursor-paginated from the start (`packages/contracts/src/common/
pagination.ts`'s `CursorQuery`/`paginatedResponse`) — this is already
  the sync-ready convention (ADR-0002), and it's also the performance
  guardrail; an unpaginated "get all transactions" is both a sync-design
  gap and a future performance cliff.
- **`findMany` without a `where` scoping to the authenticated user** —
  besides being a data-isolation bug, it's also a full-table-scan
  footgun as data grows. Every list query should filter by `userId` (or
  the equivalent module-appropriate owner field) as the first condition.

## The one DB read every authenticated request pays

`verifyAccessTokenAndSession` does a session lookup on every
authenticated request (ADR-0004's deliberate revocation trade-off). This
is an accepted cost, not a bug — don't "fix" it by removing the check
(see the `security` skill for why). If this ever becomes a measured
bottleneck, the fix is a short-TTL cache of non-revoked session IDs, not
removing the check.

## Next.js specifics

- RSC pages calling `packages/core` services directly for reads (allowed
  per `backend-architecture`) avoid an HTTP round-trip — a real
  performance win, not just an ergonomics one. Don't undo it by routing
  an RSC page's read through its own `/api/v1` route unnecessarily.
- Static vs. dynamic rendering: pages that don't need per-request data
  (a future marketing/pricing page) should be static; don't mark
  something `force-dynamic` out of caution when it doesn't read
  per-request state.

## When there IS a production target to measure against

Revisit `observability-and-instrumentation`'s deferred metrics/tracing
plan — RED metrics (rate/errors/duration) per endpoint, p95/p99 latency
histograms, not averages. Not needed until Stage C exists.
