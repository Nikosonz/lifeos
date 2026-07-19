---
name: nextjs-review
description: Next.js 16 App Router checklist specific to this repo's proven gotchas — use when reviewing or writing anything under apps/web (route handlers, pages, layouts, proxy.ts). Complements the generic code-review skill with LifeOS/Next-16-specific traps already hit this session.
---

# Next.js review checklist for LifeOS

Every item here is either a mistake already made and fixed this session,
or a documented gotcha in CLAUDE.md — this is the fast pre-flight check
before trusting `apps/web` code, not a generic Next.js tutorial.

## The five things that will actually bite you here

1. **`proxy.ts`, never `middleware.ts`.** Next 16 renamed it; having both
   breaks every build. If you ever see a `middleware.ts` show up (e.g.
   from a copy-pasted example), delete it.
2. **Dynamic route params and `cookies()` are Promises.** `{ params }:
{ params: Promise<{ id: string }> }`, then `const { id } = await
params`. Forgetting the `await` typechecks fine in some cases and
   fails at runtime — don't trust "it compiled."
3. **`runRoute`'s generic `Ctx` default matters more than it looks.**
   `apps/web/src/lib/route-handler.ts`'s `Ctx = { params:
Promise<Record<string, never>> }` default isn't decorative — a bare
   `undefined` default passes `tsc --noEmit` fine and fails only inside
   `next build`'s generated route-type validator
   (`.next/types/validator.ts`). This already broke a build once this
   session. **Run `npm run build`, not just typecheck, after touching
   `runRoute`'s signature or adding a new dynamic route.**
4. **Relative imports in anything Turbopack bundles must be
   extensionless** — no `.js` suffix, even though `packages/core`/`db`/
   `contracts` are TypeScript source. See ADR-0005; this is a repo-wide
   rule, not just an `apps/web` one, because Turbopack bundles the
   packages' raw source directly into `apps/web`'s build.
5. **Route handlers under `app/api/**` never import `@lifeos/db`, only
   `@lifeos/core`.** `eslint.config.js`'s `boundaries/element-types` rule
   enforces this — if lint complains about a `db` import from a
   `web-routes` file, that's not a lint config bug, fix the import.

## Server Components vs. Client Components

- Login/interactive forms are `"use client"`, thin — they call `fetch()`
  against `/api/v1/**`, never business logic (see
  `apps/web/src/app/[locale]/login/page.tsx` for the pattern: collect
  input, call the API, render whatever it says back).
- RSC pages may call `@lifeos/core` service singletons directly for
  reads (avoids a self-HTTP round-trip) — but the same read capability
  must still exist as an `/api/v1` route for other clients (Rule 4). Don't
  let an RSC-only convenience quietly become the only way to get that
  data.

## i18n specifics

- `fa` is default, RTL, `localeDetection: false` — don't add
  browser-locale auto-detection, it was deliberately turned off.
- Every new page needs both `messages/fa.json` and `messages/en.json`
  entries — a missing key fails ugly at render time, not at build time.
- `dir="rtl"` is set per-locale in `app/[locale]/layout.tsx` — don't
  hardcode `dir="ltr"` anywhere it could apply to a `fa` render.

## Before calling any apps/web change done

Run the actual sequence in `.claude/skills/verify/SKILL.md`, not just
`npm run typecheck`/`npm test` — this repo has already demonstrated that
typecheck-clean code can fail at Next's build step or at runtime in ways
neither `tsc` nor `node:test` catches.
