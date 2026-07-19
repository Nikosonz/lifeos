---
name: geo
description: Use when making LifeOS's public pages citable by AI answer engines (ChatGPT, Perplexity, Google AI Overviews) — same scope caveat as technical-seo, applies only to the public/marketing surface, never the authenticated app.
---

# GEO (AI search / answer-engine optimization) for LifeOS

Same scope boundary as `technical-seo`: this applies only to LifeOS's
public marketing pages, never the authenticated product. Read
`technical-seo` first if the indexability question isn't already
settled for the page in question.

## Why this matters for LifeOS specifically

A Persian life-management platform is exactly the kind of product
category ("best budgeting app for Iran," "Jalali calendar task manager")
that shows up in AI-answer-engine queries before traditional search
results, especially for Farsi-language queries where AI overviews are
increasingly the first surface a prospective user sees.

## What makes a page citable (once there's real content to apply this to)

- **Direct, extractable answers near the top of the page** — AI crawlers
  and answer engines favor content that states the answer plainly
  (e.g. "LifeOS supports the Jalali calendar, IRR/Toman budgeting, and
  OTP login — no password required") over content that builds up to it.
- **Structured data** (Organization, SoftwareApplication schema) — see
  the `schema` skill in the global skill set for JSON-LD generation
  patterns; apply here once the marketing pages exist.
- **`llms.txt`** — not yet created; add one once there's enough public
  content to warrant an agent-readable summary of the site.
- **Crawlability for AI user-agents specifically** — verify `robots.txt`
  (once it exists) doesn't accidentally block `GPTBot`,
  `PerplexityBot`, `Google-Extended`, etc. alongside blocking the
  authenticated routes from regular search crawlers.

## Farsi-language AI visibility

Most AI-answer-engine optimization guidance in circulation is written
and tested against English content. Verify claims work in Farsi
specifically rather than assuming they transfer — RTL content structure,
Persian-language query phrasing, and which AI engines actually have
meaningful Farsi coverage are all things to check empirically once there
are real pages to test against, not assume from English-language SEO
literature.

## Don't over-apply this yet

Identical caveat to `technical-seo`: there's no real marketing content
yet. This skill is here so that when the marketing pages _are_ built,
GEO is considered from the first draft rather than bolted on later.
