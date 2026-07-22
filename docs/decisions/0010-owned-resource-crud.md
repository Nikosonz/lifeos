# ADR-0010: `OwnedResourceCrud` — a shared ownership+audit skeleton for core services, not per-module hand-copying

## Status

Accepted

## Date

2026-07-22

## Context

An architecture review of the five built modules (Auth, Finance, Tasks, Calendar, Habits) found that `WalletService`, `CategoryService`, `BudgetService`, `LabelService`, `ProjectService`, `CalendarEventService`, and `HabitService` each hand-copy the identical skeleton the Module Pattern established with Auth: a private `getOwned(id, userId)` doing `findById` + ownership/soft-delete check + `NotFoundError`, wrapped around a repository mutation and an audit-log write whose metadata key (`walletId`, `categoryId`, `labelId`, ...) is mechanically derivable from the entity's own name. Every one of the seven repositories already shares the same structural shape (`create`/`findById`/`findByUserId`/`update`/`softDelete`), so nothing about the duplication is a real domain difference — it's the same scaffold, retyped seven times.

This is well past the point ADR-0006 already used to justify promoting `jalali.ts` to a shared location ("promote once a second consumer needs it") — seven real consumers, not two.

## Decision

Introduce `OwnedResourceCrud` (`packages/core/src/shared/owned-resource-crud.ts`), a small class each service **composes** (constructor-injects), not extends — nothing in this codebase uses class inheritance today; every service is a flat class taking its collaborators as constructor arguments, and composition keeps that convention intact.

Each service constructs its own instance, configured once with an entity name (`"Wallet"`) and an audit action-prefix (`"finance.wallet"`). The audit-log metadata key is auto-derived from the entity name (`lowerFirst(entityName) + "Id"`) — verified against every existing service, this holds with zero exceptions today.

`OwnedResourceCrud` exposes five methods: `getOwned`, `audit`, and three convenience compositions — `create`, `update`, `delete` — each just `getOwned` (where relevant) + the repository call + `audit`. Services with one divergent step don't get a configuration hook for it; they call `getOwned`/`audit` directly and write that one step by hand:

- `ProjectService.deleteProject` calls `projectRepository.softDeleteAndUnassignTasks` (not a plain `softDelete` — no such method exists on `ITaskProjectRepository`), so it skips the bundled `delete` and composes `getOwned` + its own repository call + `audit` itself.
- `LabelService.createLabel`/`updateLabel` wrap the repository call in a try/catch translating `LabelNameConflictError` to `ConflictError` — they skip the bundled `create`/`update` for the same reason.
- `BudgetService.createOrUpdateBudget` checks the **category's** ownership, not the budget's (the budget may not exist yet) — it can't use the helper's `create` at all for that method, and its audit verb is `"upserted"`, not `"created"`.
- `WalletService`'s extra `logger.info` calls on create/delete need no accommodation — they just run after the bundled convenience method returns.

## Alternatives Considered

### Base class, services extend it

- Pros: fewer characters at each call site (no explicit constructor wiring).
- Cons: introduces the first class-inheritance pattern in a codebase that has never used one; makes the four divergent-step services (Project, Label, Budget, Wallet) awkward to express as method overrides instead of straightforward composition.
- Rejected: composition fits the existing "accept dependencies via constructor" convention exactly; inheritance would be a new pattern introduced for this one case.

### A configuration hook per divergent step (custom delete function, error translator, alternate ownership check)

- Pros: every service could fully delegate `create`/`update`/`delete`, even the four with a divergent step.
- Cons: each hook accommodates exactly one outlier — the interface grows a parameter for every real service that isn't quite standard, which is the shallow-parameter smell this change is meant to avoid.
- Rejected: exposing `getOwned`/`audit` as independently-callable pieces lets every real outlier compose around its one divergent step without the shared interface growing to fit it.

### Leave the duplication in place

- Rejected: already past the "second consumer" bar this project's own ADR-0006 used to justify promotion elsewhere, with no technical obstacle blocking it (unlike the repository layer, where Prisma's typed API genuinely resists a generic base).

## Consequences

- Every future module's service (Notes, when built) composes `OwnedResourceCrud` from the start rather than hand-copying the skeleton an eighth time.
- Per-service tests for ownership-rejection, soft-delete exclusion, and audit-log content move to `owned-resource-crud.test.ts`, written once. Each service's own test file keeps only its real domain-logic tests (balance math, streak math, name-conflict handling) plus one or two smoke tests confirming it's actually wired to `OwnedResourceCrud` and hasn't silently bypassed it.
- A repository without a plain `softDelete` (or any other structural mismatch) is a signal that service to skip the corresponding convenience method, not a reason to add a parameter to `OwnedResourceCrud` itself.
