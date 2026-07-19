---
name: backend-architecture
description: Use when adding a new backend module (Finance, Tasks, Habits, Calendar, ...) or reviewing whether a change respects LifeOS's layering. Operationalizes CLAUDE.md's Module Pattern and Architecture Rules into a build checklist.
---

# LifeOS backend architecture

The five non-negotiable rules live in CLAUDE.md. This skill is the
checklist for actually building something that satisfies them, using the
Auth module (`packages/*/src/auth/**`, `apps/web/src/app/api/v1/auth/**`)
as the reference implementation to copy.

## Before writing any code for a new module, ask

**"Can Android use this?"** If a capability only works through a Next.js
page or Server Action, redesign it before writing the service layer, not
after.

## Build order (matches how Auth was actually built)

1. **Prisma schema** (`packages/db/prisma/schema.prisma`): every user-data
   model gets `id` (`@default(uuid())`), `createdAt`, `updatedAt`,
   `deletedAt DateTime?`, `version Int @default(1)`. Run
   `npx prisma migrate dev --name <module>_module` from `packages/db`.
2. **Repositories** (`packages/db/src/repositories/<model>-repository.ts`):
   one class per model, each paired with an `I<Model>Repository` interface.
   **The interface is what core depends on, not the class** — TS classes
   with `private` fields are nominal, not structural, so a plain
   in-memory test fake can't satisfy a concrete-class-typed constructor
   parameter. See `otp-repository.ts` for the pattern. Export both from
   `packages/db/src/index.ts`.
3. **Core services** (`packages/core/src/<module>/services/*.ts`):
   business rules, constructor-injected against the `I*Repository`
   interfaces. Only add a `ports/` + `adapters/` pair for something
   genuinely swappable across environments (mock vs. real SMS provider is
   the existing example) — not for every dependency; that's needless
   indirection.
4. **Composition root** (`packages/core/src/<module>/container.ts`): the
   _only_ file that imports `@lifeos/db` for this module. Wires concrete
   repositories into services, exports a ready-to-use singleton (see
   `authService` in `auth/container.ts`). Export it from
   `packages/core/src/index.ts`.
5. **Contracts** (`packages/contracts/src/<module>/schemas.ts`): a Zod
   schema for every request/response body. Route handlers call
   `Schema.parse(...)` and let `ZodError` bubble up —
   `packages/core/src/http/response.ts`'s `toErrorEnvelope` converts it
   centrally. Never catch `ZodError` in a route handler.
6. **Routes** (`apps/web/src/app/api/v1/<module>/**/route.ts`): thin.
   Parse → call the core singleton → map the Prisma model to the
   contract's response shape (plain field mapping) → return from a
   `runRoute()`-wrapped handler (`apps/web/src/lib/route-handler.ts`).
7. **Tests**: `packages/core/tests/<service>.test.ts` with in-memory fakes
   typed against the `I*Repository` interfaces — no mocking library, no
   Postgres. Type the fake's backing array against the real Prisma model
   type, never `any`.
8. **Verify against real Postgres**: curl the actual routes with Docker
   running — see `.claude/skills/verify/SKILL.md`. This is the substitute
   for automated integration tests; add real ones only if correctness
   genuinely depends on DB-specific behavior (constraints, transactions) a
   fake can't exercise.

## The boundary rule in one sentence

`apps/web` and `apps/worker` import `@lifeos/core` only, never
`@lifeos/db`. If you catch yourself importing `@lifeos/db` from anywhere
under `apps/*`, the composition root belongs in `packages/core` instead —
`eslint.config.js`'s `boundaries/element-types` rule will fail the lint
either way, so this isn't optional.

## Common mistake this catches

Putting a calculation, filter, or aggregation (dashboard totals, streaks,
budget rollups, report numbers) in a React component or route handler
"just this once because it's simple." It still violates Rule 1. Push it
into a `packages/core` service, even a one-line one — the next client
needs it too.
