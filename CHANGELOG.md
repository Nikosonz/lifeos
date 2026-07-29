# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project doesn't have a first tagged release yet, so everything so far
lives under `[Unreleased]` — version numbers start with the first real tag.

## [Unreleased]

### Added

- Monorepo foundation: npm workspaces (`packages/{contracts,core,db}` +
  `apps/{web,worker}`), cross-cutting error/logging/validation
  infrastructure, ESLint import-boundary enforcement, local Docker
  Postgres + Redis.
- **Auth module**: OTP-based login (SMS via a mock adapter pending a real
  Iranian SMS provider), short-lived JWT access tokens + opaque, rotating
  refresh tokens, session/device management (list + revoke active sessions).
- **Finance module**: wallets, categories, transactions, and budgets, with
  a derived (never stored) balance and an idempotent create/update path
  for transactions and budgets via an `Idempotency-Key` header.
- **Tasks module**: tasks, subtasks, projects, and labels, with
  server-owned manual kanban ordering.
- **Calendar module**: Jalali/Gregorian events with recurrence (`rrule`),
  an Iranian holiday lookup, and an agenda view composing events, task
  deadlines, and holidays into one merged timeline.
- **Reports & Notifications module**: in-app notifications, a
  budget-exceeded trigger fired from Finance, and a composed dashboard
  report endpoint.
- **Habits module** (backend only, no UI yet): habits with daily/weekly
  frequency, day-level check-ins (soft-delete + revive on the same day
  rather than duplicating rows), and a streak computed on read from
  check-in history — never stored.
- **Finance module UI**: the first web UI pass — Tailwind v4 + shadcn/ui
  foundation, Farsi/RTL, a full vertical slice (dashboard, wallets,
  categories, transactions, budgets) backed by TanStack Query.
- **Tasks module UI**: task list with status filter and cursor-based
  pagination, create/edit dialog (status, priority, project, label
  multi-assignment, deadline), a subtasks dialog (add/complete/delete),
  and Projects/Labels management pages — same conventions as Finance's UI.
  Manual kanban reordering isn't exposed yet (see CLAUDE.md's Web UI
  Architecture section for why).
- **Calendar module UI**: an Agenda view merging own events, task
  deadlines, and Iranian holidays into one chronological, day-grouped
  timeline, plus an event create/edit dialog with recurrence controls
  (daily/weekly/monthly/yearly, interval, weekday multi-select, end by
  count or by date) — same conventions as Finance/Tasks' UI. Task and
  holiday rows in the Agenda are read-only projections; editing a task's
  deadline still happens in the Tasks module.
- **Notifications + Reports module UI**: a notifications list (unread
  indicator, mark-read, mark-all-read, cursor pagination) and a monthly
  Reports page composing Finance's dashboard totals with Tasks'
  completion counts — same conventions as every other module's UI. Every
  module now has real UI; the nav's placeholder "Soon" row is gone.
- **Calendar week view**: a Saturday-start weekly grid alongside the
  existing Agenda list, toggleable and persisted per-browser. Reuses the
  agenda endpoint's existing range query — no backend change needed.
- **Per-module accent colors**: five module hues (finance/tasks/calendar/
  notifications/reports) applied to nav icons, page-header accent bars,
  and Calendar chips colored by source — replacing the previously
  all-neutral palette.
- **First-run onboarding tour + per-page help**: a one-time, spotlight-style
  walkthrough on first login (sidebar nav, per-page help, logout), plus a
  "?" help button on every module page opening a short how-this-page-works
  dialog.
- **Email login**: `POST /api/v1/auth/request-otp` and `verify-otp` now
  accept either `{phone}` or `{email}` (exactly one) — same OTP rules
  (cooldown, attempt limit, expiry) either way, delivered via a new
  `EmailProvider` port (mock adapter, mirrors the SMS one). Logging in by
  phone once and by email another time creates two separate accounts;
  there's no identity-linking flow yet.
- **Habits module UI**: a habit list with derived streaks, a one-click
  "check in today" toggle, and a collapsible per-habit monthly calendar
  grid (Saturday-first, click any scheduled day to check it in or undo
  it) — same conventions as every other module's UI, plus its own accent
  color. Every roadmap module now has both backend and UI.
- Repository workflow formalized: `CONTRIBUTING.md` (branch/commit/PR
  conventions, squash-merge-only, ownership split), `CHANGELOG.md` (this
  file), PR/issue templates, and a `prisma validate` CI gate.
- Production deploy groundwork for Stage C: multi-stage Dockerfiles for
  `apps/web` and `apps/worker`, `docker-compose.prod.yml` (including a
  one-off `migrate` service), and an SSH-based `deploy` CI job — inert
  until a VPS is provisioned and its secrets are configured.
- CI pipeline (`.github/workflows/ci.yml`): lint, format check, typecheck,
  unit tests, a real-Postgres migration check, and a production build,
  gating every pull request.
- Nine Architecture Decision Records under `docs/decisions/` covering the
  biggest, hardest-to-reverse calls made so far (monolith vs. separate
  API, sync-ready vs. offline-first, hosting, auth token strategy, module
  resolution, calendar/recurrence libraries, idempotency storage,
  notification dispatch).

- **API rate limiting**, Redis-backed with an in-memory fallback when
  `REDIS_URL` is unset. Per-IP limits on the unauthenticated auth routes
  (`request-otp`, `verify-otp`, `refresh`), returning `429` with a
  `Retry-After` header. Limits fail open if the store is unreachable, so a
  Redis outage can't take the API down with it.
- **Security headers** on every response, `/api/v1` included: CSP,
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and
  `Permissions-Policy` everywhere, plus HSTS in production builds.
- **Display name on your account.** New accounts are asked for a name
  right after their first sign-in, on web and mobile, and can skip it —
  a name is always optional and can be changed or removed later.
- **Settings screen** on both web and mobile: display name, time zone,
  calendar preference, and (mobile) theme mode, alongside links to your
  active devices and the privacy policy.
- **Device management on the web**, which previously only existed on
  mobile: see every device signed in to your account and sign any of them
  out remotely.
- **Privacy policy page** (Farsi and English), linked from the landing
  footer, the sign-in consent line, and mobile Settings. It states plainly
  what is stored, what is not collected (no third-party analytics, no
  trackers, no Android permission beyond internet access), and how to
  request account deletion.

- **Crash reporting and usage statistics**, sent only to our own server —
  no third-party analytics service is involved. If the app hits an error, a
  report is saved on the device and sent on the next launch; a small, fixed
  set of usage events is also collected. You can turn all of it off in
  Settings, after which nothing is collected at all, and the privacy policy
  describes exactly what is sent.

- **Delete your account, from either app.** Settings now has a delete
  option that permanently removes your account and everything in it —
  transactions, tasks, habits, events and notes — in one step. It asks you
  to type a confirmation word first, because there is no undo and no
  recovery window. Previously the privacy policy promised deletion but the
  only way to request it was an email address.

### Changed

- The timezone setting has been removed from both apps. It was stored and
  it was editable, but nothing ever read it — every date boundary in the
  app is Tehran time regardless — so changing it did nothing observable
  while implying your "today" would move with it. It will come back when
  it actually works.
- Signing in now distinguishes a brand-new account from a returning one,
  so the name step is only ever shown once rather than on every sign-in.
  Account creation is also recorded as its own entry in the audit log,
  separate from the sign-in that accompanies it.
- The mobile theme switcher moved from the overflow menu into the new
  Settings screen, so display preferences live in one place.

- The OTP resend cooldown is now enforced by a single atomic operation
  instead of a read-then-write against Postgres that two simultaneous
  requests could both pass.
- Dynamic path parameters (`[id]`, `[subtaskId]`) are validated as UUIDs.
  A malformed id now returns `400 VALIDATION_ERROR` naming the offending
  segment, where it previously reached the database and surfaced as a
  `500`.

### Fixed

- The habits list no longer slows down as your history grows. It used to
  load every check-in you had ever made, once per habit, just to work out
  your streaks; it now does that in a single query.
- Phone numbers and email addresses are no longer written in full to the
  audit log, which is append-only and outlives the account. Existing rows
  have been scrubbed.

### Security

- A release build now refuses to run without a real signing key instead of
  silently falling back to the debug one. A debug-signed upload would
  permanently tie the store listing to a key that only exists on one
  machine and cannot be replaced.
- Misconfiguration now fails at startup rather than at the first affected
  request: production requires `REDIS_URL` (without it every rate limit is
  silently multiplied by the number of running instances) and
  `DATABASE_URL`, and refuses to start with the development OTP override
  set.
- Three foreign keys that had no usable index are indexed, so deleting an
  account no longer scans those tables end to end.
