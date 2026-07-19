---
name: technical-seo
description: Use when working on LifeOS's public/marketing pages (home, pricing, any future landing pages) — NOT the authenticated app. Scopes what SEO even means for a product like this before applying generic SEO checklists.
---

# Technical SEO for LifeOS

LifeOS is an authenticated life-management app, not a content site — most
of the product (dashboard, tasks, finance, calendar) is behind login and
**must never be indexed**. This skill exists to draw that line clearly
before applying any generic SEO checklist to the wrong pages.

## What's actually indexable

Only the public, unauthenticated routes under `app/[locale]/` that exist
_outside_ the logged-in product — today that's just the home page
(`app/[locale]/page.tsx`) and the login page (which shouldn't be indexed
either — see below). As marketing pages get built (pricing, features,
about), they're the ones this skill applies to.

## What must stay out of the index

- Everything under `/api/**` — already correctly non-renderable, no
  action needed.
- `/[locale]/login` and any future authenticated route
  (`/[locale]/dashboard`, etc.) — add `noindex` via
  `generateMetadata`'s `robots: { index: false }`, and list them in
  `robots.txt`'s disallow rules once that file exists.
- Anything with a JWT/session token in a query param or fragment — never
  let a URL structure make this possible in the first place (this app
  doesn't, by design — tokens are Bearer-header-only, see ADR-0004).

## For the pages that ARE public

Standard technical SEO applies once there's real marketing content to
optimize: `generateMetadata` per page (title, description, canonical,
OpenGraph), a real `sitemap.ts` listing only the public routes, hreflang
between the `fa`/`en` locale variants (next-intl already gives locale
routing — hreflang tags need to be added explicitly, they don't come free
with `[locale]` routing).

**Follow Google's official documentation as the source of truth** — same
policy as the sibling `pouyakarimi.ir` project. Prioritize
developers.google.com/search guidance over third-party SEO blogs when
they conflict. (Note: `developers.google.com` 403s WebFetch from this
dev machine — cite from known canonical URLs rather than fetching
directly, same workaround as the sibling project.)

## Farsi-specific consideration

`fa` is the default locale (RTL) — make sure any future `hreflang`/
`sitemap` work treats `fa` as `x-default` or the primary variant, not
`en`, matching the product's actual audience priority.

## Don't over-apply this yet

There is currently one real page (`app/[locale]/page.tsx`, a placeholder)
and one page that shouldn't be indexed (`login`). Don't build a
`sitemap.ts`, `robots.txt`, or a full metadata strategy for content that
doesn't exist yet — revisit when actual marketing pages are scoped.
