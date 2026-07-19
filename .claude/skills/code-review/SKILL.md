---
name: code-review
description: LifeOS-specific code review checklist — the project's own architecture rules turned into review questions. Use for any non-trivial change, especially new modules. Complements (doesn't replace) the generic code-reviewer skill and /code-review command for broad correctness/security sweeps.
---

# LifeOS code review checklist

Generic code review (the `/code-review` command, the `code-reviewer`
skill) catches bugs, security issues, and style problems in general. This
skill is the LifeOS-specific layer on top — the questions that come from
_this_ project's architecture rules, which a generic reviewer has no way
to know.

## The five architecture rules, as review questions

1. **Rule 1 (no business logic in clients)**: Is there any calculation,
   filter, aggregation, or decision in a React component, a route
   handler's response mapping, or a Server Action — instead of in
   `packages/core`? A one-line `total = items.reduce(...)` in a component
   still counts.
2. **Rule 2 (single source of truth)**: Does this duplicate logic that
   already exists in a `packages/core` service under a different name? Grep
   before writing.
3. **Rule 3 (APIs only)**: If this PR adds a Server Action, does the same
   capability also exist as an `/api/v1` route? A Server-Action-only
   mutation is a Rule-3 violation even if it's convenient.
4. **Rule 4 (reusable across clients)**: Would this design work
   unchanged if the caller were a Telegram bot instead of the web UI?
   If the answer depends on a browser-only affordance (cookies, DOM APIs)
   for something that isn't presentation, that's a flag.
5. **Rule 5 (module isolation)**: Does this module's service reach into
   another module's Prisma models directly, instead of calling that
   module's own core service/singleton?

## Mechanical checks (should already be green, verify they are)

- `npm run lint` — the `boundaries/element-types` rule catches most Rule
  1/2/4 violations automatically. If lint is clean, that specific class
  of violation is ruled out; it doesn't mean the design is right.
- `npm run typecheck`, `npm test`, `npm run format:check` — all four,
  not a subset.
- **`npm run build`** in addition to typecheck for any `apps/web` change
  — see `nextjs-review` for why this specifically has caught a real bug
  that typecheck alone missed.

## Patterns to expect (deviation is worth asking about, not necessarily wrong)

- New repository → paired `I*Repository` interface (see
  `backend-architecture`).
- New service → constructor-injected against interfaces, not concrete
  db-backed classes.
- New route → wrapped in `runRoute()`, parses via a `packages/contracts`
  schema, maps the Prisma model to the contract shape by hand (not a
  generic serializer).
- New Prisma model → sync-ready fields present (`id`, `createdAt`,
  `updatedAt`, `deletedAt`, `version`).
- New test → in-memory fake typed against the real Prisma model type,
  not `any`.

## Things this codebase has specifically gotten wrong before (check these didn't recur)

- `.js`-suffixed relative imports (breaks Turbopack, not `tsc` — ADR-0005).
- A `runRoute` context type that satisfies `tsc` but not `next build`
  (see `nextjs-review`).
- Non-timing-safe comparison of a hash/token (see the `security` skill).
- A secret-scan false positive on a legitimate `localhost` dev DSN (fixed
  in `.githooks/pre-commit`/`pre-push` — don't re-introduce an
  over-broad pattern without the same localhost exclusion).
