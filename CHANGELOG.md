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
