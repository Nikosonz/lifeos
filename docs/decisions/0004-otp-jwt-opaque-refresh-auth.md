# ADR-0004: OTP login, short-lived JWT access tokens, opaque refresh tokens

## Status

Accepted

## Date

2026-07-18

## Context

Auth is the first module and the pattern every later module copies (CLAUDE.md Module Pattern). It needs to work identically for a browser, a mobile app, a Telegram bot, and an MCP client — ruling out anything browser-cookie-specific as the _only_ mechanism — and needs real revocation (a user must be able to kill a stolen session immediately, not wait out a token's natural expiry).

## Decision

- **Login is OTP-only, no passwords.** A 6-digit code, generated with `node:crypto.randomInt` (never `Math.random`), hashed (SHA-256) before storage, 5-minute expiry, 60-second per-phone resend cooldown, 5 max verify attempts.
- **Access tokens are short-lived JWTs** (15 min, HS256 via `jose`), stateless and cheap to verify.
- **Refresh tokens are opaque random strings** (`crypto.randomBytes(32).toString("base64url")`), never JWTs — only their SHA-256 hash is stored server-side, rotated on every use.
- **Every access-token verification also checks the session's `revokedAt` in the database** — a deliberate extra DB read per request that makes logout/revoke take effect immediately instead of waiting out the 15-minute JWT expiry.

## Alternatives Considered

### Password-based auth

- Rejected: Iranian phone-first user base, plus no password-reset-email infrastructure exists yet (no transactional email provider is wired up, unlike the sibling portfolio project's Resend integration). OTP-over-SMS is the natural primary flow; Google OAuth is noted as an optional secondary path but deliberately not primary, since it's known to be unreliable for users behind Iranian network filtering.

### Pure JWT refresh tokens (no DB-backed session record)

- Pros: Fully stateless, no DB read on refresh.
- Cons: A JWT refresh token cannot be revoked before its own expiry without a blocklist — which just reintroduces the DB-state problem this alternative was trying to avoid, except now as an ad hoc blocklist instead of a proper Session table.
- Rejected: The DB-backed opaque-token model gives real revocation _and_ a natural place to hang device/session metadata (`userAgent`, `ipAddress`, `lastUsedAt`) for the device-management feature (`GET/DELETE /api/v1/auth/sessions`), which the spec requires from day one anyway.

### Stateless access-token verification only (skip the per-request session/`revokedAt` check)

- Pros: One fewer DB read per authenticated request.
- Cons: A revoked session stays valid for up to 15 minutes (the access token's remaining lifetime) — "logout" wouldn't actually log anyone out promptly.
- Rejected: The defense-in-depth DB check was judged worth one extra read per request; 15 minutes of a supposedly-revoked session being usable is not acceptable for a security-sensitive module.

## Consequences

- `packages/core/src/config/env.ts` requires only `JWT_ACCESS_SECRET` (≥32 chars) — no refresh-token secret exists at all, since refresh tokens are opaque, not signed.
- Real SMS delivery is behind the `SmsProvider` interface (`packages/core/src/auth/ports/sms-provider.ts`); swapping the `MockSmsProvider` for a Kavenegar/SMS.ir adapter touches only `packages/core/src/auth/adapters/`, nothing else.
- Every authenticated request costs one extra DB read (session lookup) beyond JWT signature verification — acceptable at current scale; revisit (e.g. short-TTL cache of non-revoked session IDs) only if this becomes a measured bottleneck.
