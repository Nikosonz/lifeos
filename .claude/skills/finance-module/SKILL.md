---
name: finance-module
description: Use when building the Finance module (wallets, transactions, budgets, savings goals, debts, recurring payments, reports) — not built yet. Combines the Module Pattern with money/Jalali-specific rules this module needs to get right from its first migration.
---

# Building the Finance module

Not started yet (P0, next after Auth per the roadmap). This skill exists
so the first migration and first service get the money-specific decisions
right immediately, rather than needing a correction pass later. Follow
`backend-architecture` for the general module shape; this adds what's
specific to money.

## Non-negotiable from day one (see `lifeos-domain` + ADR-0002)

- Every amount column is `BigInt`, minor units, with an explicit
  `currency` column (IRR only today, but the column exists regardless).
- Every model gets the sync-ready fields (`id`, `createdAt`, `updatedAt`,
  `deletedAt`, `version`) — same as every other module.
- Mutating endpoints (create/update transaction, apply a recurring
  payment) accept an `Idempotency-Key` header and de-dupe on it — this is
  the first module where that actually matters (a duplicated financial
  transaction is a real user-facing bug, not a cosmetic one).
- Budget periods and "this month's spending" aggregate on **Jalali**
  month boundaries, computed server-side — never let a client compute
  "which Jalali month does this transaction fall in."

## Likely model shape (draft — confirm against the actual spec before migrating)

`Wallet` (user-owned, balance is _derived_ from transactions, never
stored+mutated directly — recompute or maintain via a running total
updated transactionally, but the ledger of `Transaction` rows is the
source of truth), `Transaction` (income/expense, wallet FK, category FK,
amount, currency, occurredAt, tags), `Category`, `Budget` (category +
Jalali-month period + limit), `SavingsGoal`, `RecurringPayment` (this one
needs `apps/worker` — see `deployment` skill for why the worker isn't
production-ready yet), `Debt`/`Loan`/`Installment`.

## Reports and dashboard numbers

"Remaining budget," "financial score," cash-flow forecasts — all of this
is Rule-1 territory: computed in a `packages/core` service, never in a
route handler's response-mapping step and never in a React component.
The route handler's job stays limited to calling the service and mapping
the result to the contract shape.

## AI capture ("I spent 250,000 Tomans on lunch")

When the AI module (see `ai-coach` skill) extracts a transaction from
natural language, it should call the _same_ Finance core service a manual
form submission would — the extraction is a new input adapter, not a
parallel path that duplicates the transaction-creation business logic.
