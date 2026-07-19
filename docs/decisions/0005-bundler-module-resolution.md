# ADR-0005: `bundler` module resolution everywhere, not `NodeNext`

## Status

Accepted

## Date

2026-07-18

## Context

`packages/contracts`, `packages/core`, and `packages/db` are consumed two different ways: directly by `node --import tsx` (unit tests, standalone scripts) and by Next.js/Turbopack, which bundles their raw `.ts` source directly into `apps/web`'s build graph rather than consuming a pre-built `dist/`. These two consumers disagree about how relative imports should be written. This was discovered the hard way mid-build (not decided up front): the packages started on `NodeNext` resolution, which TypeScript/Node's ESM rules require for `.js`-suffixed relative imports pointing at `.ts` source files (e.g. `from "../errors/app-error.js"`). That works fine under `tsc`/`tsx`, but Turbopack applies `apps/web`'s own bundler-resolution rules to _everything_ it processes, including the packages' source — and bundler resolution doesn't understand the NodeNext `.js`-pointing-at-`.ts` convention, producing `Module not found: Can't resolve './auth/container.js'` even though `container.ts` exists.

## Decision

Every `tsconfig.json` in the repo (root `tsconfig.base.json` and every package/app) uses `"module": "ESNext"` + `"moduleResolution": "bundler"`. Every relative import everywhere is extensionless (`from "../errors/app-error"`, never `.js`).

## Alternatives Considered

### Keep `NodeNext` for packages, `bundler` for `apps/web` only

- Pros: `NodeNext` is arguably the more "correct" choice for packages that are meant to be portable Node libraries in principle.
- Cons: This is exactly the configuration that produced the Turbopack build failure — Turbopack doesn't care what a dependency package's own `tsconfig.json` says, it applies `apps/web`'s resolution to everything in the module graph it touches.
- Rejected: Directly caused a real, reproduced build failure. Not viable as long as Next.js bundles workspace packages from source rather than from a compiled `dist/`.

### Pre-build packages to `dist/` and have `apps/web` consume compiled output instead of source

- Pros: Would let packages keep `NodeNext` resolution in isolation, since Next.js would only ever see already-compiled, already-`.js`-extensioned output.
- Cons: Adds a build step and a watch/rebuild loop to local development for every package change — meaningful DX cost for a monorepo this size, this early.
- Rejected for now: The `bundler`-everywhere fix cost nothing beyond stripping `.js` suffixes from existing imports, and Turbopack's live source consumption is a genuine DX win (edit `packages/core`, see it instantly in `next dev` with no rebuild step) worth preserving.

## Consequences

- Any new relative import anywhere in `packages/*` or `apps/*` must be extensionless — a `.js`-suffixed relative import will silently work under standalone `tsc`/`tsx` and only break inside `next build`/`next dev`, which makes this an easy mistake to reintroduce without noticing until a Next.js build is actually run.
- `apps/worker`'s `build` script (`tsc -p tsconfig.json`) now emits real `.js` output with extensionless relative imports, which plain Node ESM cannot load directly (Node's own resolution, unlike bundler resolution, requires explicit extensions). This is fine today since the worker has no real logic yet, but is a known blocker for its first production build — see CLAUDE.md Known Limitations; switch to a bundler (`tsup`/`esbuild`) for the worker's build step before that matters.
- A related cosmetic (non-fatal) Turbopack warning appears in `next dev` output about `packages/db/generated/prisma/index.js` being a CommonJS module accessed via `export *` — harmless, left as-is (see CLAUDE.md).
