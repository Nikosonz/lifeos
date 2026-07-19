---
name: article-review
description: Use when reviewing any written content for LifeOS's public pages — blog posts, help-center articles, in-app onboarding copy. No content pipeline exists yet; this is the review bar for whenever one is built.
---

# Article / content review for LifeOS

No blog, help center, or content pipeline exists yet in this repo. This
skill is the review checklist for whenever written content gets added —
don't build a content pipeline speculatively; use this when actual
content work starts.

## Bilingual by default

Every piece of public content needs both `fa` (default, RTL) and `en`
variants — see the i18n setup in `apps/web/src/messages/{fa,en}.json` and
`apps/web/src/i18n/routing.ts`. A Farsi-only or English-only article is
incomplete, not a "translate later" backlog item, given `fa` is the
platform's primary audience.

## Accuracy against the actual product

The single biggest risk for this kind of content is describing a feature
that doesn't exist yet or describing behavior that's already changed.
Before publishing anything that claims LifeOS "does X":

1. Check the claim against the actual current code/CLAUDE.md, not memory
   or the original platform spec (the spec is aspirational; CLAUDE.md and
   the code are what's real _today_).
2. If describing an API capability, verify against
   `packages/contracts/src/**/schemas.ts` — the contract is the ground
   truth for what a client can actually do.
3. Flag anything describing a not-yet-built module (Finance, Tasks, AI,
   ...) as clearly forward-looking, not current functionality.

## Tone

Match the platform's actual positioning — a life-management platform for
Persian-speaking users, not a generic global SaaS translated into Farsi.
Money examples should use Toman (the culturally natural display unit,
even though IRR is the stored unit — see `lifeos-domain`), dates should
default to Jalali in examples aimed at the `fa` audience.

## Structural bar (once real articles exist)

- Clear H1, scannable headings, no walls of text — same bar as any
  technical content, doubled for RTL where line length and heading
  hierarchy affect readability differently than LTR.
- Internal links to the actual feature/page being described, not vague
  references.
- No unverified claims about pricing, availability, or timelines that
  the product/business side hasn't confirmed.
