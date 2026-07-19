---
name: security
description: LifeOS-specific security checklist — auth/session invariants, secret hygiene, and the concrete gaps already found in this codebase's own security review. Use for anything touching auth, tokens, sessions, or secrets; complements the generic security-reviewer skill.
---

# Security checklist for LifeOS

Generic security review (`security-reviewer`, `/security-review`) covers
OWASP-style concerns broadly. This is what's specific to this codebase —
invariants already established, and gaps already found and either fixed
or deliberately deferred.

## Auth/session invariants (must hold — see ADR-0004)

- Access tokens are JWTs, 15 min, HS256 via `jose`. Refresh tokens are
  **opaque random strings, never JWTs** — only their SHA-256 hash is
  stored. If you ever see a refresh token being decoded/verified as a
  JWT, that's a regression to the rejected "pure JWT refresh" alternative.
- **Every access-token verification also checks `revokedAt` in the
  database** (`SessionService.verifyAccessTokenAndSession`) — this is
  what makes logout/revoke take effect immediately. Don't "optimize away"
  this DB read without understanding you're reintroducing the 15-minute
  revocation-delay problem ADR-0004 explicitly rejected.
- **Refresh rotates on every use**; a reused (already-rotated) refresh
  token must fail immediately (`UnauthorizedError`) — this is the replay
  protection.
- **Session ownership is checked, not just token validity** — revoking a
  session verifies `session.userId === userId` before revoking, and the
  error message must not leak whether a session ID exists at all when it
  belongs to someone else (`"Session not found"`, not
  `"Session belongs to another user"`).
- **OTP hash comparison is constant-time**
  (`node:crypto.timingSafeEqual` in `otp-service.ts`) — found in this
  project's own security review; a plain `!==` string comparison on a
  hash is a (low-severity but real) timing-attack surface. Don't
  reintroduce a bare `!==`/`===` for any secret/token/hash comparison
  anywhere in the codebase.

## Known, deliberately-deferred gaps (don't rediscover these as if new)

- **No per-IP rate limiting on `request-otp`** — the per-phone cooldown
  doesn't stop spamming _many different_ numbers. Low-risk today (mock
  SMS adapter), becomes a real cost/abuse risk the moment a real SMS
  provider is wired in. Add Redis-backed IP throttling before that
  happens, not after.
- **`Session.ipAddress` is read from `x-forwarded-for`, client-suppliable
  and unvalidated.** It's a display-only field for session/device
  management — never use it for a security decision. Fix (trust only a
  reverse-proxy-injected header like Cloudflare's `CF-Connecting-IP`)
  when the VPS deploy (Stage C) puts a real proxy in front of the app.
- **Web client stores tokens in `localStorage`.** Necessary for now — the
  API must work identically for every client, and only the web client
  can even use cookies. This means an XSS bug on the web app is more
  dangerous than it would be with httpOnly cookies. If the web app grows
  meaningful third-party-script surface, revisit a cookie-based session
  layer for the web client specifically (still Rule-3-compliant as a
  thin adapter) while other clients keep raw Bearer tokens.

## Secret hygiene (see CLAUDE.md "Secret Hygiene" for the full policy)

- `.githooks/pre-commit` and `pre-push` scan for secret-shaped strings —
  **the DSN pattern deliberately excludes `@localhost`/`@127.0.0.1`**
  after a real false positive on the docker-compose dev credential
  (`lifeos:lifeos_dev@localhost`). Don't tighten this pattern back up
  without re-testing against that exact string.
- `.claude/hooks/block-dangerous-git.mjs` blocks Claude itself from
  running `git push`/`reset --hard`/`clean -f`/`branch -D`/
  `checkout .` — a second, independent layer beyond the pre-push hook,
  operating at the tool-call level rather than the git-hook level.
- Never log a real OTP code or token outside `MockSmsProvider` (which
  logs the code _because_ that's how the mock delivers it in dev — a
  real `SmsProvider` adapter must never do this). Structured log calls in
  `AuthService` mask the phone number (`maskPhone`) — follow that pattern
  for any new PII field going into a log line.

## Before trusting any auth-adjacent change

Run the actual verify sequence (`.claude/skills/verify/SKILL.md`),
including the cross-user ownership probe (user B tries to revoke user
A's session) — this is exactly the kind of check a bare `tsc`/test pass
won't catch, and it's already caught real issues in this codebase's own
history.
