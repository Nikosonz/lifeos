# Prisma 6 → 7 migration plan

Not yet executed — see CLAUDE.md Known Limitations for why this is deliberately deferred (6.2.1 already works end-to-end; don't upgrade mid-scaffold). This document is the concrete plan for when it happens, so that session doesn't start from scratch.

## What actually changes (verified against Prisma's official 6→7 upgrade guide)

1. **Generator provider renames**: `prisma-client-js` → `prisma-client`. The old provider is slated for removal in a future release, so this isn't optional long-term.
2. **Driver adapters become mandatory**, not optional — Prisma 7 requires instantiating `PrismaClient` with a driver adapter for every database, including plain Postgres. For us that's `@prisma/adapter-pg`.
3. **Generated client import path changes**: `../generated/prisma/index` → `../generated/prisma/client` (this is exactly the shape the sibling `pouyakarimi.ir` project already uses, since it's on Prisma 7 with the Neon driver adapter).
4. **A `prisma.config.ts` file at the project root replaces some `package.json`/CLI-flag configuration.**
5. **`prisma db seed` must be run explicitly** — no longer automatic as part of `migrate dev`/`migrate reset`.
6. **ESM requirements** — `"type": "module"` and ESM-compatible `tsconfig.json` (we already have both, repo-wide, per ADR-0005).

## Concrete steps for this repo

1. Bump `packages/db/package.json`: `prisma` and `@prisma/client` to the 7.x line; add `@prisma/adapter-pg`.
2. `packages/db/prisma/schema.prisma`: change `generator client { provider = "prisma-client-js" }` to `provider = "prisma-client"`. Confirm the existing `output = "../generated/prisma"` path still applies, or adjust per the 7.x default.
3. `packages/db/src/client.ts`: change the import from `../generated/prisma/index` to `../generated/prisma/client`, and construct `PrismaClient` with a `PrismaPg` adapter instance instead of relying on the implicit `DATABASE_URL` datasource lookup:
   ```ts
   import { PrismaPg } from "@prisma/adapter-pg";
   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
   export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
   ```
4. Add a `packages/db/prisma.config.ts` per the 7.x convention (exact shape TBD at migration time — check the then-current docs, since this is new in 7.x and worth re-verifying rather than trusting this plan's memory of it).
5. Update every `packages/db/src/repositories/*.ts` and `packages/core/src/auth/container.ts` import path if the barrel re-export path (`packages/db/src/index.ts`'s `export * from "../generated/prisma/index"`) changes to `.../client`.
6. Re-run `npx prisma generate` and `npx prisma migrate dev` against the local Docker Postgres — confirm the existing migration history in `packages/db/prisma/migrations/` still applies cleanly (it should; the migration SQL itself doesn't change, only the client generation).
7. **Re-run the full auth verification sequence** (`.claude/skills/verify/SKILL.md`) end-to-end — this is a client-generation and connection-instantiation change, exactly the kind of thing that can compile fine and fail at runtime.
8. Update `docker-compose.yml`'s Postgres image / `binaryTargets` in `schema.prisma` only if the 7.x engine requirements changed (check at migration time).
9. Update CLAUDE.md's Stack table and Known Limitations entry once done; retire this document or mark it "completed" at the top.

## Why this is a deliberate, separate pass (not bundled into other work)

Every step above touches the one file (`packages/db/src/client.ts`) every single database read/write in the entire application depends on transitively through `packages/core`. A mistake here doesn't fail loudly at compile time in every case — the adapter-vs-datasource-URL distinction in particular is a runtime connection-construction change. Bundling this with unrelated feature work (e.g. the Finance module) would make it hard to isolate which change caused a regression. Do this upgrade in its own commit, its own verification pass, nothing else in the diff.
