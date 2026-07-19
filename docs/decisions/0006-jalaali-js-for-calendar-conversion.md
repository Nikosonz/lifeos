# ADR-0006: `jalaali-js` for Jalali calendar conversion

## Status

Accepted

## Date

2026-07-19

## Context

The Finance module's first business rule that touches dates is Jalali month boundaries: budgets are per Jalali month, and "this month's spending" must aggregate on Tehran-local Jalali month boundaries, not Gregorian ones (CLAUDE.md's Money & Date Conventions). This needed a real Jalali↔Gregorian conversion library — no code in this repo did this conversion before now.

## Decision

Use `jalaali-js` (exact-pinned `2.0.0`), specifically its pure `toJalaali`/`toGregorian` numeric-argument functions, wrapped in `packages/core/src/finance/jalali.ts`.

A load-bearing detail the wrapper exists to handle: `jalaali-js`'s `toJalaali(date: Date)` overload reads the Date via `getFullYear()`/`getMonth()`/`getDate()` — **process-local-timezone getters, not UTC ones**. Since the dev machine, CI runners, and the eventual VPS can each have different local TZ configuration, that overload's result would silently depend on the host's timezone. The wrapper instead always uses the numeric overloads (`toJalaali(gy, gm, gd)` / `toGregorian(jy, jm, jd)`) and does the Tehran-offset shift manually with UTC getters, so the conversion is correct regardless of host TZ. The Tehran offset itself is hardcoded at a fixed +03:30 (Iran has used no DST since 2022) rather than derived from a tz database — documented as an assumption to revisit if that policy reverses, or once `User` carries its own `timezone` column.

## Alternatives Considered

### `date-fns-jalali`

- Pros: A full date-fns-compatible replacement — Jalali-aware `format`/`parse`/`add`/`sub`.
- Cons: This project uses no `date-fns` anywhere today. Adopting it here means introducing an entire second date-handling paradigm (immutable wrapper functions, format tokens) alongside the native `Date`/`Intl` used everywhere else in the codebase, for a need that's genuinely just two pure conversion functions plus month-boundary arithmetic.
- Rejected: disproportionate to the actual need; would also make the choice of date library inconsistent across modules for no functional benefit.

### Hand-rolled Jalali↔Gregorian conversion

- Pros: Zero new dependency.
- Cons: The conversion has real edge cases — Jalali's leap-year rule (based on the 33-year/2820-year cycle approximation of the true solar year) differs from Gregorian's and is easy to get subtly wrong at year boundaries.
- Rejected: this is exactly the kind of self-contained, well-defined problem a small, focused, already-tested library should own rather than reimplementing.

## Consequences

- Every future Jalali boundary calculation (Tasks/Habits/Calendar modules, when built) should reuse `packages/core/src/finance/jalali.ts`'s functions (or a version promoted to a shared location if a second module needs them) rather than reintroducing a second calendar library or hand-rolled math.
- The fixed +03:30 Tehran offset is an accepted simplification; if Iran ever reintroduces DST, or once per-user timezones become real (`User.timezone`), the offset needs to become a lookup rather than a constant — a schema and code change, not just a config flip.
- This is expensive to reverse in the sense that swapping the calendar library later touches every Jalali boundary calculation across every module that's since started depending on it — worth getting right now rather than revisiting per-module.
