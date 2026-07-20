# Architecture Decision Records

Sequentially numbered records of significant, expensive-to-reverse decisions — the _why_ behind choices that CLAUDE.md documents the _what_ and _how_ of. Don't delete superseded ADRs; write a new one that references and supersedes the old.

| ADR                                                | Decision                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [0001](0001-nextjs-modular-monolith.md)            | Next.js modular monolith over a separate API service                                |
| [0002](0002-sync-ready-not-offline-first.md)       | Sync-ready schema, not offline-first, for the MVP                                   |
| [0003](0003-vps-docker-hosting.md)                 | VPS + Docker hosting over Vercel or Iranian cloud                                   |
| [0004](0004-otp-jwt-opaque-refresh-auth.md)        | OTP login, short-lived JWT access tokens, opaque refresh tokens                     |
| [0005](0005-bundler-module-resolution.md)          | `bundler` module resolution everywhere, not `NodeNext`                              |
| [0006](0006-jalaali-js-for-calendar-conversion.md) | `jalaali-js` for Jalali calendar conversion, not `date-fns-jalali`                  |
| [0007](0007-postgres-idempotency-keys.md)          | Postgres table (not Redis) for idempotency keys                                     |
| [0008](0008-rrule-for-recurrence.md)               | `rrule` for recurrence expansion, not hand-rolled RFC5545-lite math                 |
| [0009](0009-in-process-notification-dispatch.md)   | In-process, synchronous, best-effort notification dispatch, not an event bus/outbox |
