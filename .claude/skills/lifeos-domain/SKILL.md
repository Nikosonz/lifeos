---
name: lifeos-domain
description: Domain glossary and Iran-specific business rules for LifeOS — Jalali calendar boundaries, money conventions, phone/SMS format, and cultural defaults. Use when a feature touches dates, money, or anything Iran-specific, or when a term in a spec/ticket is ambiguous.
---

# LifeOS domain knowledge

Ubiquitous language for a Persian life-management platform. Not a
UI/framework skill — this is about getting the _business rules_ right,
which are easy to get subtly wrong for a non-Iranian-market-native
engineer (or agent).

## Calendar

- **Jalali (Shamsi) is the primary calendar for the user**, Gregorian is
  secondary. Both must be supported, but Jalali month/week boundaries are
  what business logic (budgets, weekly stats, reports) aggregates on —
  this is a business decision, not a display detail. See CLAUDE.md "Money
  & Date Conventions."
- **The week starts on Saturday**, not Sunday or Monday. "This week's
  habit streak" or "weekly budget" means Saturday–Friday.
- **Store `timestamptz` (UTC) always.** Convert to Jalali only at the
  server boundary where a Jalali-aligned aggregation is being computed
  (e.g. "this Jalali month's spending"), using `jalaali-js` or
  `date-fns-jalali` (planned, not yet installed). Never store a Jalali
  date string as the source of truth — it can't be sorted/ranged the way
  a real timestamp can.
- User profile carries `timezone` (default `Asia/Tehran`) and a
  `calendar` preference (`jalali` | `gregorian`) for _display_ — this is
  the one place calendar choice is a legitimate client/presentation
  concern (CLAUDE.md Rule 1).
- Iranian public holidays affect scheduling/reminders (not yet
  implemented) — when built, holiday data is a lookup table in
  `packages/core`, not a client-side calendar library's built-in holiday
  list (those are usually wrong or incomplete for Iran).

## Money

- **Base currency is IRR (Rial), stored as `BigInt` minor units.** Never
  float, never Toman as the stored unit.
- **Toman is a display-scale concern only** — Toman = Rial ÷ 10. The
  conversion happens in the presentation layer, never in storage or in a
  core calculation. If you see a `BigInt` being divided by 10 anywhere
  outside a formatting function, that's a bug.
- Every money-bearing model has an explicit `currency` column even though
  only IRR exists today — multi-currency is a plausible future need and
  the column is free to add now, expensive to retrofit later (same
  reasoning as ADR-0002's sync-ready fields).
- Financial mutations should be idempotent (`Idempotency-Key` header) —
  not yet implemented, add when the Finance module lands.

## Phone / identity

- Phone numbers are the primary identity (see ADR-0004) — E.164-ish,
  validated by `packages/contracts/src/auth/schemas.ts`'s `PhoneNumber`
  regex (`+989123456789` or `989123456789`, first digit after country
  code non-zero).
- **SMS delivery must go through an Iranian provider** (Kavenegar or
  SMS.ir are the two candidates) once real — generic international SMS
  APIs (Twilio, etc.) are typically unreliable or blocked for Iranian
  numbers. This is why `SmsProvider` is a port/adapter pair
  (`packages/core/src/auth/ports/sms-provider.ts`) instead of a hardcoded
  call.
- **Google OAuth login is optional/secondary, never primary** — it's
  known to be unreliable for users behind Iranian network filtering.

## AI / external services

- **OpenAI/Anthropic APIs are not directly reachable/billable from
  Iran.** Any AI feature (natural-language expense/task capture, AI
  coach) must go through a provider-abstraction layer from day one — see
  `ai-coach` skill — not a direct SDK call baked into a service.

## Product shape

- Multi-user consumer app, each user owns only their own data. No
  teams/organizations, no billing in the MVP (see plan assumptions) —
  don't design a feature around shared/team ownership unless a future
  spec explicitly introduces it.
