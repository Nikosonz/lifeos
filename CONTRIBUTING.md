# Contributing to LifeOS

Trunk-based development with short-lived feature branches, for a small team.
`main` is always deployable. Everything else here exists to keep it that way
without adding process for its own sake. See `CLAUDE.md` for the actual
architecture rules this workflow protects — this file is about how we get
code into `main` safely, not what the code should look like.

## Branch strategy

`main` is the only permanent branch. Never commit or push directly to it.

Every change starts on a short-lived branch, named by type and (when one
exists) the GitHub issue number:

```
feature/<issue>-<short-name>   feature/12-telegram-login
fix/<issue>-<short-name>       fix/33-login-bug
refactor/<scope>               refactor/api-service
docs/<topic>                   docs/setup-guide
test/<scope>                   test/auth-service
chore/<task>                   chore/bump-deps
```

No long-lived `develop`/`staging` branch — branches live days, not weeks.

## Daily workflow

```bash
git checkout main
git pull origin main
git checkout -b feature/<issue>-<task>

# ...work, small logical commits...

git push -u origin feature/<issue>-<task>
# open a PR, wait for review, merge (squash), then:

git checkout main
git pull origin main
git branch -d feature/<issue>-<task>   # GitHub also auto-deletes the remote branch on merge
```

If you catch yourself already committed to `main` locally: `git checkout -b
feature/<name>` right where you are (this doesn't move `main`'s pointer),
then reset `main` back to `origin/main` before continuing.

## Commits — Conventional Commits

```
feat: add Telegram authentication
fix: prevent duplicate requests
refactor: simplify the API layer
docs: update installation guide
test: add auth service unit tests
style: format project
chore: update dependencies
```

- One logical change per commit — don't mix unrelated work.
- No vague messages (`update`, `fix stuff`, `changes`). If you can't
  describe the commit in one line without "and", split it.
- Reference the issue number where it applies: `feat: add Telegram login (#12)`.
- Prefer commits under ~300 changed lines. A commit that's bigger than that
  is usually two commits that haven't been separated yet.

## Pull requests

Every PR description covers:

- **Summary** — what changed.
- **Why** — what need or bug prompted it.
- **Testing** — how you verified it (unit tests, curl against local
  Postgres, manual UI pass — whatever's actually true for this change).
- **Checklist** — build passes, lint passes, no console/debug logs, no
  stray TODOs, no secrets committed, no unused files.

Reference the issue: `Closes #12`. Prefer PRs under ~500 changed lines —
past that, look for a natural split (e.g. schema+repository in one PR,
routes+UI in a follow-up).

Never open a PR with failing checks. Before pushing:

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

(`.githooks/pre-push` already runs this full gate automatically — see
CLAUDE.md's "Secret Hygiene" section for exactly what the hooks do. This
list is what to expect, not an extra manual step.)

## Code review

Before approving, check:

- Readability and naming consistency
- No duplicated logic
- Security (input validation, auth checks, no leaked secrets)
- Error handling
- Performance (N+1 queries, unnecessary re-renders)
- Simplicity — reject a PR that solves the problem with more machinery
  than it needs, even if the machinery is "correct"
- Does it actually follow CLAUDE.md's Architecture Rules (no business
  logic in a client, single source of truth in `packages/core`, etc.)?

## Merge strategy

**Squash and merge, always.** One commit per feature on `main`, GitHub's PR
title becomes the commit message (edit it to match Conventional Commits
before merging if the PR went through several messy WIP commits). This
keeps `main`'s history readable and rollback simple (`git revert` one
commit undoes one feature).

## Branch protection — currently a known gap, not a decision

The intent is standard protection on `main`: PR required, at least one
approval, CI passing, branch up to date before merge, no force-pushes.
**GitHub's branch protection API is unavailable on this repo today** —
it's private, and protection rules require a paid plan (GitHub Pro/Team)
or a public repo on the free tier (confirmed via `gh api
repos/{owner}/{repo}/branches/main/protection` → 403, "Upgrade to GitHub
Pro or make this repository public"). Until one of those changes, `main`
is unprotected at the platform level.

In the meantime, the actual guardrails are local, not GitHub-side:

- `.githooks/pre-push` blocks a push if lint/typecheck/test/format fail.
- Claude Code's own git-guardrail hook (`.claude/hooks/block-dangerous-git.mjs`)
  refuses to run `git push`, `git reset --hard`, `git clean -f(d)`,
  `git branch -D`, or `git checkout .`/`git restore .` on Claude's behalf.
- This document's convention — don't push to `main` directly — has to hold
  by discipline, not by a server-side rule, for now.

The moment a paid plan or public visibility is in place, apply exactly
this ruleset (`gh api -X PUT repos/{owner}/{repo}/branches/main/protection`
or the Settings → Branches UI): require a PR, require 1 approval, require
the `quality`/`build`/`db-migration` CI checks, require the branch be
up to date, disallow force pushes.

## Handling merge conflicts

Don't let them sit. As soon as you notice `main` has moved:

```bash
git checkout main
git pull origin main
git checkout feature/<branch>
git merge main        # or: git rebase main
# resolve, then continue
```

Resolve immediately — never leave a branch in a conflicted state overnight.

## Ownership

Informal, not enforced by CODEOWNERS yet (solo-maintained repo today —
see below). As a second developer joins:

- **Backend owner**: `packages/core`, `packages/db`, `apps/web/src/app/api`,
  Auth/API/database work.
- **Frontend owner**: `apps/web/src/components`, `apps/web/src/app/[locale]`
  (UI pages), styling/UX.
- **Shared, touch with a heads-up first**: `schema.prisma`, root
  `package.json`/`package-lock.json`, `eslint.config.js`, `next.config.mjs`,
  `proxy.ts`, `tsconfig.json` — changes here affect both areas.

`.github/CODEOWNERS` isn't created yet because there's only one GitHub
account on this repo right now — add it (mapping the paths above to each
person's `@handle`) the day a second developer's account exists, so review
requests route automatically.

## Issues

Every non-trivial feature starts as a GitHub Issue (`#12 Telegram Login`),
referenced in the branch name (`feature/12-telegram-login`) and in commits/
PRs where it applies. Trivial fixes/chores don't need an issue first — use
judgment, don't create process for a one-line typo fix.

## Quality gates (CI)

Every PR runs, via `.github/workflows/ci.yml`:

- `quality` job: lint, format check, typecheck, unit tests
- `db-migration` job: `prisma validate` + `prisma migrate deploy` against a
  real Postgres service container
- `build` job: production build

All must pass before merge — there is no "merge anyway" override.

## Labels

`feature`, `fix`/`bug`, `documentation`, `refactor`, `test`, `chore`,
`performance`, `security`, `backend`, `frontend`, `database`, `api`, plus
GitHub's stock `enhancement`/`good first issue`/`help wanted`/`wontfix`/
`duplicate`/`invalid`/`question` and Dependabot's `dependencies`/
`github_actions`. Apply the type label(s) that describe what actually
changed — an issue can carry more than one (e.g. `feature` + `backend`).

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/).
Add an entry under `## [Unreleased]` (Added/Changed/Fixed/Removed) as part
of the PR that ships the change — not a separate follow-up step.

## Architecture decisions

Significant, expensive-to-reverse technical decisions get an ADR in
`docs/decisions/` (see `docs/decisions/README.md` for the existing ones
and the numbering convention) — not a separate `docs/adr/` directory.
