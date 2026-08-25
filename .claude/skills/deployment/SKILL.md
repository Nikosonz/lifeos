---
name: deployment
description: Use when deploying, debugging, or changing the production Stage C deploy. LifeOS is LIVE on a shared VPS (185.202.113.176) behind host Caddy on maaleto.ir as of 2026-08-25. Read this before touching the Dockerfiles, prod compose file, Caddyfile, or deploy workflow — it records the live topology and the gotchas already paid for, several of which are specific to sharing the host with an n8n instance and a VPN.
---

# 🟢 LIVE as of 2026-08-25 — read this section first

The stack is deployed. `/opt/maaleto/repo` on `185.202.113.176`, secrets in
`/opt/maaleto/repo/.env` (600), reverse-proxied by **host** Caddy (systemd,
not a container). Runbook and credentials: `D:\Pouya\Maaleto credentials\PRODUCTION DEPLOYMENT.txt`.

**The host is shared** with an unrelated n8n automation and a Hermes agent.
That constraint caused most of the surprises below. Treat any change here as
capable of taking down a service that has nothing to do with this app.

## Gotchas found doing the real deploy (2026-08-25)

- 🔴 **An empty env var is not an unset one, and it took the whole app down.**
  `docker-compose.prod.yml` passes optionals through as `${KAVENEGAR_API_KEY:-}`;
  Compose resolves that to `""` rather than omitting the key, and Zod's
  `.optional()` only skips an _absent_ key — so `""` failed `.min(1)`, `getEnv()`
  threw, and **every route returned 500** naming a provider nobody had selected.
  `getEnv()` now strips empty values. The tell was that a deliberately malformed
  body also returned 500 instead of its documented 400: three unrelated inputs
  failing identically means nothing is reaching route code.
  It survived the July VM smoke test only because the env schema landed
  2026-07-29, eight days later, and was never re-run against the prod compose file.
- 🔴 **Caddy's HTTP/3 fights the VPN for UDP 443.** AmneziaWG listens on UDP 443
  on this host. Caddy enables HTTP/3 by default, which binds the same port, and
  it refused to start: `listen udp :443: bind: address already in use`. The
  Caddyfile sets `protocols h1 h2`. **Never "fix" this by moving the VPN** — it
  is the box's real network path. TCP 443 was free all along. Caddy failing
  closed rather than stealing the port is why nothing broke.
- 🔴 **The secrets file must be named `.env`, not `.env.production`.** Compose
  auto-loads only `.env` from the project directory and the CI deploy job passes
  no `--env-file`; any other name starts the stack with every variable empty.
  It survives the deploy job's `git reset --hard` because `.gitignore` keeps it
  untracked.
- **The placeholder worker restart-loops in production.** It prints one line and
  exits 0; `restart: unless-stopped` respawns it forever. It is behind
  `profiles: ["worker"]` now — delete that line in the same change that gives it
  a real job.
- **`command_timeout: 30m` on the CI deploy step is load-bearing.** A cold
  `next build` on the 2-CPU host exceeds `appleboy/ssh-action`'s 10m default,
  which kills the session mid-build and leaves the stack down.
- **Nested heredocs over SSH are not worth it.** Writing the Caddyfile via
  `ssh … <<'X'` containing its own `<<` mangled the file. Write locally, `scp`,
  then `tr -d '\r'` on the far side — the repo ships CRLF (see CLAUDE.md).
- **Verify CR/LF with Python, not shell one-liners.** `grep -c $"\r"` and
  `od -c | grep -cx '\\r'` both returned confident false positives on a file
  that provably had zero CR bytes.

---

# Deploying LifeOS (Stage C — background and rationale)

Per CLAUDE.md's delivery sequence (local → git → VPS) and ADR-0003, this
is the third and final stage. Everything below was written while building
the deployment artifacts, before a host existed; it is kept because the
reasoning still applies. For what is actually running today, read the LIVE
section above first — where the two disagree, the LIVE section wins.

## Target (per ADR-0003, and what was actually built)

ADR-0003 called for a VPS behind Cloudflare running Postgres, Redis, the
Next.js app and the worker under `docker-compose`. As deployed: the VPS and
compose stack are exactly that, but **Cloudflare was not used** — Caddy on
the host terminates TLS directly, which is one fewer third party in front of
an app whose users are in Iran. The worker is defined but not running (see
the LIVE section). The SSH `deploy` job in `.github/workflows/ci.yml` is no
longer inert: `DEPLOY_HOST` and its three companion secrets exist, so a merge
to `main` deploys.

## Dev-only things that must NOT ship as-is

- **`docker-compose.yml`'s Postgres/Redis credentials**
  (`lifeos`/`lifeos_dev`) are dev-only, deliberately simple, and
  documented as safe to expose (see the `security` skill's note on the
  secret-scanner's localhost exclusion). Production needs real generated
  secrets, provisioned via GitHub Actions Secrets or the VPS's own secret
  store — never committed, never reused from `.env.example`.
- **`JWT_ACCESS_SECRET`** needs a real, freshly generated production value
  — never the placeholder used in local `.env` files or CI's
  build-time placeholder (`ci-build-placeholder-secret-at-least-32-chars`
  in `.github/workflows/ci.yml` — that one exists only so `next build`
  has _a_ syntactically valid secret, it must never be the runtime value).
- **`x-forwarded-for`-based `ipAddress`** (see `security` skill) — once
  Cloudflare is actually in front of the app, switch to trusting
  Cloudflare's own client-IP header instead of the raw, spoofable
  `X-Forwarded-For`.
- **`apps/worker`'s build step** — fixed 2026-07-20: switched from raw
  `tsc -p tsconfig.json` (per ADR-0005's consequences, emitted
  extensionless-import `.js` plain Node ESM can't load) to `tsup` (see
  `apps/worker/tsup.config.ts`). Verified directly, not just build-success:
  `node dist/index.js` runs correctly, including a throwaway smoke test
  proving `@lifeos/core` inlines correctly. `@lifeos/db` is NOT yet safe to
  import from the worker — see the Gotchas section below.

## Prisma in production

- Migrations: `prisma migrate deploy` (non-interactive, safe for CI/CD),
  never `migrate dev` against a production database.
- The `linux-musl-openssl-3.0.x` binary target already in
  `packages/db/prisma/schema.prisma` exists specifically so an
  Alpine-based production image needs no client regeneration — verify
  this assumption still holds against whatever base image the production
  Dockerfile actually uses.
- Revisit whether Prisma 7 (`docs/prisma-7-migration-plan.md`) should
  happen _before_ or _after_ Stage C — either order is defensible, but
  don't let the Prisma major-version upgrade and the first production
  deploy happen in the same change; isolate variables.

## What doesn't need to change

- The monolith/module-boundary architecture (ADR-0001) — nothing about
  going to production changes how `apps/web`/`apps/worker` relate to
  `packages/*`.
- The auth token strategy (ADR-0004) — no cookie-based session needed
  for the API itself; TLS termination at Cloudflare/the VPS is what makes
  Bearer-token-over-HTTPS acceptable in production (verify HTTPS is
  actually enforced end-to-end before shipping, not just at Cloudflare's
  edge).

## First deploy checklist

**Steps 1, 5 and 6 were completed 2026-08-25** — see the LIVE section at the
top. Cloudflare was _not_ used (Caddy terminates TLS directly); if it is added
later, the only required change is pointing `TRUSTED_PROXY_IP_HEADER` at
`cf-connecting-ip`. The historical text below is kept for the reasoning.

1. ✅ Provision the **VPS** (a real, internet-facing host), install Docker,
   configure Cloudflare — **the one step nothing else here can substitute
   for.** Done 2026-08-25 on a shared host; Cloudflare deliberately skipped. What _is_ done (2026-07-21): the entire
   production pipeline below was smoke-deployed for real against a local
   Ubuntu 26.04 VirtualBox VM (reachable only via a host-only NAT
   port-forward, not the internet) — real generated secrets in `.env`
   (never the dev/CI placeholders), the `migrate` profile applying all 5
   migrations to a genuinely empty Postgres, then `up -d --build` bringing
   up postgres+redis+web+worker, verified with a real `request-otp` →
   `verify-otp` round trip (actual DB rows, actual JWT issued) against the
   containerized standalone app — not just `docker build` succeeding. This
   proves the compose file, Dockerfiles, and secret-handling all work
   end-to-end; it does not substitute for provisioning a real VPS
   (different concerns: public IP, TLS, Cloudflare, `DEPLOY_HOST` secret).
2. ✅ Production `Dockerfile`s for `apps/web` (multi-stage, `output:
"standalone"` in `next.config.mjs`, Alpine + the
   `linux-musl-openssl-3.0.x` binary target) and `apps/worker` (tsup
   bundle — see `apps/worker/tsup.config.ts`'s own extensive comments on
   what it inlines vs. externalizes and why). Verified for real: built
   both images, ran them against real Postgres (not just `docker build`
   succeeding), confirmed an actual DB write (`request-otp`) through the
   containerized standalone app.
3. ✅ `docker-compose.prod.yml` — separate from the dev
   `docker-compose.yml`, real secrets required via `${VAR:?...}` (fails
   loudly if unset, no dev-value fallback), no bind-mounted source, plus a
   `migrate` one-off service (`profiles: [migrate]`, targets the
   `builder` stage since the lean runtime images deliberately don't ship
   the `prisma` CLI). Verified for real against a genuinely empty
   Postgres: all 5 migrations applied cleanly from scratch, then the full
   stack (postgres+redis+web+worker) came up via `docker compose up -d
--build` and served a real request.
4. ✅ `.github/workflows/ci.yml` extended with a `deploy` job (SSH via
   `appleboy/ssh-action`), gated on `quality`+`build`+`db-migration`
   passing and `main`+push. Currently a deliberate no-op: the deploy
   _step_ is guarded by `env.DEPLOY_HOST != ''` (not a job-level `if:` —
   `secrets` isn't a valid context in ANY `if:`, confirmed with
   `actionlint` after two wrong attempts assumed otherwise), so it skips
   cleanly until `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY`/
   `DEPLOY_PATH` are added as repo secrets. Validated with `actionlint`
   (zero errors) — not yet run for real, since step 1 hasn't happened.
5. 🔶 Re-run the full verify sequence (`.claude/skills/verify/SKILL.md`)
   against the deployed instance. Partially done: routing, validation,
   rate-limit store selection, both OTP-channel guards and the migration
   path are all verified in production. The `verify-otp` half is blocked
   until `maaleto.ir` resolves and Resend verifies the domain — until then
   a real code cannot be delivered to a real inbox. Finish it then.
6. ✅ Update CLAUDE.md's delivery-sequence note once Stage C is live.

## Gotchas found while building the above (2026-07-20), before a VPS existed

- **`.dockerignore` pattern matching needs an explicit `**/` prefix to
  match at any depth** — unlike `.gitignore`, a bare `.env*` at the
  context root only matched a root-level `.env`, NOT
  `apps/web/.env`/`packages/db/.env`. Confirmed by literally building a
  throwaway image and finding both files inside it despite `.dockerignore`
  supposedly excluding them. Fixed by doubling every pattern that needs to
  match at any depth (`.env*` **and** `**/.env*`) rather than trusting the
  distinction gets remembered correctly next time this file is touched.
- **npm workspaces + one shared `package-lock.json` means a root `npm ci`
  (even with `--omit=dev`) installs every workspace's regular
  dependencies, not just the one you're building.** Measured directly:
  the worker's runtime image was ~1.1GB, ~500MB of it `next`/`@swc`/
  `@prisma`/`@img` (sharp) — all `apps/web`'s dependencies, none of which
  the worker imports. A real fix needs workspace-aware pruning (Turborepo
  `prune`, pnpm, or a hand-rolled post-install prune script) —
  deliberately not built, matching CLAUDE.md's "add Turborepo later only
  if build times/output size actually demand it" stance. Revisit once the
  worker has real jobs; a placeholder doesn't justify that complexity yet.
- **`apps/worker`'s tsup bundle can fully inline `@lifeos/core`/
  `@lifeos/contracts`** (verified: `noExternal` + a throwaway `logger`
  import + `node dist/index.js` ran correctly) **but NOT `@lifeos/db`
  as-is** — its `main` field also points at raw TypeScript with no
  compiled output, so an external, unbundled reference to it hits
  `ERR_UNKNOWN_FILE_EXTENSION` under plain Node (confirmed the same way).
  Not fixed, because the worker doesn't touch the database yet — see
  `tsup.config.ts`'s own comment for the two real fix options (give
  `packages/db` a compiled build output, or run the worker via `node
--import tsx` in production) when the first real job needs it.
- **A Windows/Git-Bash gotcha, not a repo issue**: `docker run`/`docker
build` invocations with absolute Unix-style paths (`-w /app/...`) get
  silently mangled by MSYS path conversion (e.g. rewritten to
  `D:/Git/app/...`) unless prefixed with `MSYS_NO_PATHCONV=1`. Cost real
  debugging time before being recognized as an environment quirk, not a
  Docker or Dockerfile problem.
- **A fresh Linux deploy target's default networking can silently break
  both `apt` and Docker registry pulls in layers, not just one** (found
  provisioning the local VM above; the same class of bug could recur on a
  real VPS with an unusual network setup). Symptoms seen here, in order:
  (1) `apt-get update` timed out — the box had a bogus router-advertised
  IPv6 default route (`fe80::2`, `proto ra`) that Go/glibc's resolver
  preferred and got no response from; fixed short-term with
  `Acquire::ForceIPv4` in apt config. (2) `docker buildx build` then hit
  the _same_ dead IPv6 route pulling `node:22-alpine` from
  `registry-1.docker.io` — apt's fix didn't cover Docker's own resolver,
  so IPv6 was disabled at the kernel level
  (`net.ipv6.conf.all.disable_ipv6=1` via `/etc/sysctl.d/`). (3) Even with
  IPv6 gone, `prisma generate`'s postinstall couldn't reach
  `binaries.prisma.sh` (`EAI_AGAIN`) because the DNS server itself
  (learned via DHCP) was unreachable from this network segment — fixed
  with `resolvectl dns <iface> <reachable-DNS-IP>`, **but that alone did
  not persist**: the next DHCP renewal silently reverted it. The
  persistent fix needed NetworkManager directly: `nmcli con mod
'<connection>' ipv4.ignore-auto-dns yes ipv4.dns '<reachable-DNS-IP>'`.
  Lesson: on any new deploy target, verify DNS survives a
  `nmcli con up`/reboot-equivalent re-application, not just a one-off
  `resolvectl` command — and check both `apt`'s and Docker's resolution
  path separately, since fixing one doesn't fix the other.
