---
name: testing
description: LifeOS's actual testing conventions — node:test + tsx, fakes typed against I*Repository interfaces, curl-driven real-DB verification instead of automated integration tests. Use when writing any test or deciding what kind of test a change needs.
---

# Testing conventions in LifeOS

No vitest/jest — deliberately, because `registry.npmjs.org` is blocked
from the dev machine and Node's built-in `node:test` + `tsx` needed no
extra installs to work. Don't introduce a test framework without a real
reason; this one has proven itself across 35 passing tests.

## The three tiers, and when each applies

1. **Unit tests** (`packages/*/tests/*.test.ts`, run via
   `node --import tsx --test "tests/**/*.test.ts"`): pure business-rule
   tests using in-memory fakes. This is where cooldowns, attempt limits,
   token rotation, ownership checks, and validation-schema edge cases get
   covered. Fast, no Postgres.
2. **E2E tests** (`apps/web/e2e/*.spec.ts`, Playwright): real browser,
   real `next dev`, real dockerized Postgres, for UI flows specifically —
   see `apps/web/e2e/README.md`. Young suite, not yet in CI.
3. **Curl-driven manual verification** (`.claude/skills/verify/SKILL.md`):
   the substitute for automated integration tests against the real
   database. Use this after touching anything DB-dependent, not instead
   of writing unit tests for the business rules.

Pick the tier by what you're actually checking, not by habit — a pure
business-rule question (does the 5th wrong attempt trigger a lockout?)
belongs in tier 1; whether the login _page_ actually renders and submits
correctly belongs in tier 2; whether a route handler wires everything
together against a real Postgres belongs in tier 3.

## Fakes, not mocks

Every repository has an `I*Repository` interface specifically so tests
can pass a plain object literal instead of a mocking library. See
`packages/core/tests/otp-service.test.ts` for the canonical shape:

```ts
function fakeOtpRepository(): IOtpRepository & { rows: OtpCode[] } {
  const rows: OtpCode[] = [];
  return { rows, async create(data) { ... }, ... };
}
```

Type the backing array against the real Prisma model type (`OtpCode[]`,
imported from `@lifeos/db`) — never `any[]`. ESLint's
`@typescript-eslint/no-explicit-any` blocks `any` in tests too, and a
loosely-typed fake stops catching the bugs a typed one would.

## Testing a service that depends on other services (not just repositories)

Don't introduce an interface for a service that only ever has one real
implementation (`IOtpService`, `ISessionService` — no, don't add these).
Construct the real service against fake repositories instead, and wrap
_that_ in the thing under test — see
`packages/core/tests/auth-service.test.ts` for `AuthService` built from
real `OtpService`/`SessionService` plus fake repositories. This is the
right level of indirection: interfaces where there's genuine
swappability (repositories, the `SmsProvider` port), plain construction
where there isn't.

## Coverage gaps worth actively hunting for

The facade/orchestration layer (`AuthService`-equivalent for each new
module) is the easiest layer to accidentally leave untested — the
per-service tests don't exercise the wiring (does the facade actually
write the audit-log row it's supposed to?). Write the facade test even
though it feels redundant with the per-service tests; it isn't.

## Every new test file must actually be included

Package `tsconfig.json`s need `"include": ["src/**/*.ts",
"tests/**/*.ts"]` — a test file outside `src` that isn't in `include`
silently never gets typechecked, even though `node --test` still runs
it fine. Verify a new `tests/` directory is covered before trusting
`npm run typecheck` to catch type errors in it.
