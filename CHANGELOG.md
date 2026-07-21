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

### Changed

- _(nothing yet — this section fills in as existing behavior changes)_

### Fixed

- _(nothing yet — this section fills in as bugs are fixed post-release)_
