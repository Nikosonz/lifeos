# ADR-0009: In-process, synchronous, best-effort notification dispatch — not an event bus/outbox

## Status

Accepted

## Date

2026-07-20

## Context

The Reports & Notifications module needs Finance's `TransactionService` to trigger a side effect owned by a different module: creating an in-app `Notification` row when a transaction pushes spend over a category's Jalali-month budget. This is the first pass where a cross-module dependency runs in the **write** direction — Calendar's `AgendaService` already proved the read direction (composing Task deadlines into a merged view), but nothing before this has had one module's mutation trigger a side effect in another module's schema.

`apps/worker` is a documented placeholder (BullMQ/ioredis installed, no real jobs wired up, and its build step doesn't survive plain Node ESM resolution yet — see CLAUDE.md's Known Limitations). Real asynchronous job infrastructure doesn't exist in this codebase yet.

This decision matters beyond this one trigger: it sets the pattern every future cross-module trigger will copy (a Task-deadline reminder, an Auth new-device-login alert, etc.), so its failure-mode contract needs to be deliberate, not incidental.

## Decision

`TransactionService.createTransaction` calls `NotificationService.create()` directly and synchronously, in-process, **after** its own write has already committed — never before, and never inside the same database transaction as the financial write. The call is wrapped in try/catch: a failure is logged at `pino error` (`event: "finance.transaction.notify_failed"`) and swallowed. It never rolls back the transaction, never retries, and never surfaces as an error on the triggering request's response.

The trigger fires only on the exact transaction that causes spend to cross the budget limit (`spentBefore <= limitAmount < spentAfter`), only on genuine-insert code paths (plain create, and the idempotent-create path after a real row is inserted) — never on `updateTransaction` (crossing is well-defined only for a single new row, not an edit that can simultaneously change amount/category/date/type) and never on the idempotent-replay path (a replay didn't change any spend total, so re-evaluating it would be redundant at best).

Finance wires its own independent `NotificationRepository`/`NotificationService` instance in its own `container.ts`, rather than importing the Notifications module's exported singleton — the same "every module wires its own instance independently" reasoning Calendar's `container.ts` already established for its own `TaskRepository` instance. Both instances are stateless wrappers over the same `notifications` table via the same `prisma` singleton, so this is behaviorally identical to sharing one instance, with the benefit that Finance's container never has to import Notifications' container (no inter-container import ordering or circularity to reason about).

A known, accepted race: two concurrent same-category transactions can each read a spend total that doesn't yet include the other's committed row, so both could independently compute "I'm the one that crossed the limit" and both fire a notification. This is tolerated as a rare, harmless duplicate — the same tolerance this project already extends to Tasks' momentary position ties — not solved with row locking.

## Alternatives Considered

### BullMQ outbox/event job (enqueue `budget.exceeded`, worker creates the `Notification` asynchronously)

- Pros: durable, retryable, doesn't couple the financial write's latency to notification-creation latency.
- Cons: no other worker consumer exists yet, and the worker's own build step needs its own fix (raw `tsc` emit doesn't survive plain Node ESM resolution) before it's fit to carry anything.
- Rejected: building real async job infrastructure now, just for this one trigger, is disproportionate scope — the exact kind of speculative build-ahead-of-need this project has consistently declined (`RecurringPayment`, Calendar's own reminders/notifications scope cut).

### Same-`prisma.$transaction` atomic write (insert `FinanceTransaction` and `Notification` in one DB transaction)

- Pros: no lost notifications, ever.
- Cons: requires Finance's repository to write directly into the `notifications` table, bypassing `NotificationService` and its interface entirely.
- Rejected: a sharper violation of module isolation (Rule 5) than a cross-module service call — it hardcodes Notifications' schema into Finance's repository layer, the opposite direction of the abstraction this project has maintained everywhere else (Calendar depends on `ITaskRepository`, not on Task's table shape directly).

## Consequences

- A notification can be silently lost on a transient failure (a thrown error inside `NotificationService.create()`, e.g. a DB hiccup). Accepted: an in-app FYI toast doesn't need money-grade durability, and losing one occasionally is a far smaller problem than the financial write itself failing or rolling back because of it.
- Every future cross-module trigger should copy this exact shape until revisited: independent per-module `NotificationService` wiring, try/catch, best-effort, fired only after the triggering write has committed.
- Revisit this decision (toward a transactional outbox row + a real worker drain) once `apps/worker`'s build step is fixed and it has a first real consumer of its own — don't assume direct-call dispatch remains right forever, but don't build the outbox speculatively either.
