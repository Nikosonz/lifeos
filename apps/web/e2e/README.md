# E2E tests (Playwright)

Real browser, real `next dev`, real dockerized Postgres — a level above the
unit tests (fakes) and one level above curl-driven API verification (no
browser/UI involved). See `.claude/skills/verify/SKILL.md` for the curl
equivalent and why OTP codes come from a log file (mock SMS provider).

## Prerequisites

```bash
docker compose up -d          # from repo root
cd apps/web
mkdir -p .tmp
(npm run dev > .tmp/dev.log 2>&1 &)
```

`apps/web/.tmp/dev.log` is deliberately repo-relative, not `/tmp` — Playwright
runs as a native Windows Node process while the dev server is typically
started from Git-Bash, and the two runtimes resolve `/tmp` to different real
directories.

## Run

```bash
npx playwright test          # headless, chromium only (see playwright.config.ts)
npx playwright test --ui     # interactive
```

Browser binaries install via the npmmirror binary mirror in this environment
(`registry.npmjs.org` and Playwright's own CDN can both be unreliable here —
see CLAUDE.md Environment Constraints):

```bash
PLAYWRIGHT_DOWNLOAD_HOST=https://registry.npmmirror.com/-/binary/playwright \
  npx playwright install chromium
```

## Gotchas found by actually running these tests (not by reading the code)

- **`getByRole("alert")` is ambiguous on this app.** Next.js's own route
  announcer (`<div role="alert" aria-live="assertive"
id="__next-route-announcer__">`) also carries `role="alert"`, so that
  locator resolves to two elements and fails Playwright's strict mode. Use
  `getByText(...)` for the login page's own error message instead.
- Each test picks a fresh phone number (`Date.now()`-based) — OTP codes are
  single-use and per-phone rate-limited, so reusing one across tests/runs
  produces a confusing `VALIDATION_ERROR` that looks like a test bug but
  isn't.

## Scope

Covers the login UI (`/[locale]/login`) only, not yet wired into CI (browser
download + a running Postgres in the Actions runner are both solvable but
deliberately deferred — the unit tests + `next build` already gate CI, and
this suite is young). Extend as new UI modules ship.
