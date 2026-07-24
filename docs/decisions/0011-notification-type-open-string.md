# ADR-0011: `NotificationType` is an open string, not a shared closed enum

## Status

Accepted

## Date

2026-07-24

## Context

`NotificationType` (both the Prisma `enum` and the matching Zod enum in `packages/contracts/src/notifications/schemas.ts`) shipped with exactly one member, `FINANCE_BUDGET_EXCEEDED` — the one trigger wired up in ADR-0009's pass. `NotificationService` itself carries an explicit code comment calling itself "deliberately domain-agnostic": it never learns what a "budget" or a "task" is, and every trigger's domain knowledge lives in the triggering module.

That domain-agnostic design has a crack: the closed enum lives in _Notifications' own_ schema and Prisma files, so every new triggering module has to edit Notifications' files to add its own event name — the opposite of domain-agnostic. This wasn't yet a real repeated pain (only one producer exists today), but CLAUDE.md's Known Limitations already names two near-term future producers that would each hit this: a task-deadline reminder and an auth new-device-login alert. ADR-0009 covers the _dispatch mechanism_ (synchronous, in-process, best-effort, independent per-module service instances) but never addressed this shared-enum-ownership question — this is a genuinely separate decision that happens to touch the same module.

## Decision

`NotificationType` becomes an open string everywhere: the Prisma column changes from `enum NotificationType` to plain `String`, and the contracts export changes from `z.enum(["FINANCE_BUDGET_EXCEEDED"])` to `z.string().min(1)`. The exported contract identifier name (`NotificationType`) stays the same, so every existing import site (`NotificationResponse`'s `type` field) needs no further edit — only its definition loosens.

Each producing module keeps its **own local string-literal type** for the values it actually sends, rather than a shared registry file. Finance's `transaction-service.ts` gets a private `type FinanceNotificationEventType = "FINANCE_BUDGET_EXCEEDED"` that the call site assigns through before passing it to `notificationService.create()` — this is what actually catches a typo at that call site; a bare `string` parameter alone would silently accept `"FINANCE_BUDGET_EXCEEEDED"`.

The migration (enum → `String`) is lossless: every existing enum value is already valid text. Prisma's own migration generator refuses to auto-cast a required column with existing data (it defaults to a destructive drop-and-recreate), so the generated migration was hand-edited to an explicit `ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT` before being applied — confirmed via `psql \d notifications` that the column is `text` post-migration with existing rows intact.

## Alternatives Considered

### Per-producer registry (each module "registers" its own value into a shared list Notifications' schema unions)

- Pros: keeps a single visible list of every value in use across the app.
- Cons: still requires editing a shared file (just moves _where_) every time a new producer ships; no precedent for this kind of cross-module registry pattern exists anywhere else in this codebase.
- Rejected: doesn't actually solve the "Notifications' own file needs an edit per producer" problem, just relocates it — and adds a new pattern for one narrow case.

### Leave the closed enum, add new values as needed

- Pros: exhaustiveness-checking at the type level for whatever the current known set is; zero migration cost today.
- Rejected: this is the leak itself — a domain-agnostic service whose own schema file must be edited by every future domain module that wants to trigger it. Two concrete near-term producers are already named in CLAUDE.md, so this isn't a hypothetical future cost being paid speculatively.

## Consequences

- Notifications' contract and Prisma schema files never need an edit again just because a new module starts triggering notifications.
- Losing enum exhaustiveness-checking at the `NotificationType` level is accepted — typo-safety moves to each producing module's own local literal type instead, which is exactly where the domain knowledge already lives per ADR-0009's "deliberately domain-agnostic" design.
- A future producer (task-deadline reminder, auth new-device alert) needs zero changes to any Notifications file — just its own local literal type and a call to `notificationService.create()`, matching the pattern `FinanceNotificationEventType` establishes here.
