# ADR-0008: `rrule` for recurrence expansion, not hand-rolled RFC5545-lite math

## Status

Accepted

## Date

2026-07-20

## Context

The Calendar module needs recurring events: `DAILY`/`WEEKLY`/`MONTHLY`/`YEARLY` frequency, an `INTERVAL`, an optional `COUNT` or `UNTIL`, and an optional `BYWEEKDAY` list for weekly recurrence. The initial draft of this module planned to hand-roll this as a small, self-contained arithmetic module (mirroring how `finance/jalali.ts` wraps a genuinely small conversion need) rather than add a dependency. A Plan-agent validation pass before implementation began pushed back on that draft.

## Decision

Use `rrule` (exact-pinned `2.8.1`), confirmed resolvable through the project's npm mirror. Wrapped in `packages/core/src/calendar/recurrence.ts` — pure functions, no I/O, one dedicated test file (`recurrence.test.ts`), same shape as `shared/jalali.ts`. Two load-bearing details the wrapper exists to handle:

- **Weekday convention mismatch**: `rrule`'s weekday enum is Monday-based (`RRule.MO..RRule.SU`); this project's own convention (matching JS `Date.getDay()`) is `0=Sunday..6=Saturday`. The wrapper maps between them at the boundary — `rrule`'s enum is never exposed past `recurrence.ts`.
- **CJS/ESM interop across two DIFFERENT runtimes**: `rrule`'s package has no `"exports"` map, so its CJS build (`main`, resolved by plain Node/tsx — the test runner) and its real-ESM build (`module`, resolved by Turbopack's bundler-only convention — the Next.js dev/build) disagree with each other on whether `RRule` is a default or named export. A named import (`import { RRule } from "rrule"`) throws at runtime under plain Node (`SyntaxError: The requested module 'rrule' does not provide an export named 'RRule'` — Node's CJS-module-lexer can't statically detect the name in that particular bundle), while a default import (`import pkg from "rrule"; const { RRule } = pkg;`) fails to even build under Turbopack (`Export default doesn't exist in target module` — the real-ESM build has no default export). Both were tried and both failed, each in only one of the two runtimes. The fix that works in both: `createRequire(import.meta.url)("rrule")`, which forces Node's CJS `require()` algorithm unconditionally — plain property access on the returned exports object doesn't depend on static export detection the way an ESM import does, and Turbopack's CJS-interop handling (already exercised elsewhere in this codebase for Prisma's generated client) bundles it the same way. Verified empirically in both runtimes (`node --import tsx --test`, and `next build`) before this was considered done.

## Alternatives Considered

### Hand-rolled RFC5545-lite recurrence math

- Pros: Zero new dependency, matching this project's general preference for small pure-function modules over libraries (the `tasks/position.ts` precedent).
- Cons: Recurrence expansion has the same _class_ of subtle, easy-to-get-wrong trap that ADR-0006 already used to reject hand-rolled Jalali conversion — concretely: month-end overflow (a monthly recurrence from Jan 31 must _skip_ the occurrence in a 30/28-day month, not clamp to the last day or roll into the next month); Feb 29 yearly recurrence must skip non-leap years, not clamp to Feb 28 or Mar 1; `WEEKLY` + `BYWEEKDAY` + `interval > 1` requires correct week-grouping semantics relative to the rule's start date; `COUNT` counts occurrences produced, not iterations of the base frequency, which is easy to off-by-one when multiple weekdays are involved. All four were verified against `rrule`'s actual output (not assumed) before writing `recurrence.test.ts`.
- Rejected: this is exactly ADR-0006's "well-defined, already-solved problem a small, focused, already-tested library should own" reasoning, applied to a materially similar class of date-arithmetic subtlety.

### `date-fns` + a recurrence add-on, or a full calendar-library adoption

- Not seriously considered: this project uses no `date-fns` anywhere (the same reasoning ADR-0006 used to reject `date-fns-jalali`), and `rrule` operates on plain native `Date`s with no paradigm shift — it solves exactly the recurrence-expansion problem and nothing more.

## Consequences

- `rrule` is now a direct dependency of `packages/core`. Any future recurrence need elsewhere in the codebase (e.g. a Habits module's own repeat/streak logic, if it ever needs general recurrence rather than a simpler daily-streak counter) should reuse `packages/core/src/calendar/recurrence.ts` rather than reintroducing a second recurrence library or hand-rolled math — same "expensive to reverse" reasoning ADR-0006 already established for the Jalali conversion choice.
- Recurrence expansion is deliberately Gregorian-only (operates on the raw UTC instant via plain calendar rollover) — it does not attempt "same day every Jalali month" recurrence, which would be a materially harder, explicitly out-of-scope feature for this pass. If that's ever needed, it's a new, separate function, not a change to this wrapper's contract.
- The `createRequire` workaround is specific to this exact `rrule` version's packaging; if `rrule` is ever upgraded to a version that ships a proper `"exports"` map (making its CJS and ESM builds agree on the export shape), this workaround should be re-verified — a plain named import may work again in both runtimes — rather than assumed to still be required.
