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
| [0010](0010-owned-resource-crud.md)                | `OwnedResourceCrud` — a composed, shared ownership+audit skeleton for core services |
| [0011](0011-notification-type-open-string.md)      | `NotificationType` is an open string, not a shared closed enum                      |
| [0012](0012-flutter-mobile-client.md)              | Flutter for the mobile client, targeting Cafe Bazaar/Myket                          |
| [0013](0013-dart-contract-generation.md)           | Custom Zod→Dart generator, not `openapi-generator-cli`                              |
| [0014](0014-mobile-push-notification-strategy.md)  | Poll for mobile notifications now; defer real push to a non-GMS provider            |
| [0015](0015-mobile-design-system.md)               | Mobile design-system tokens + shared component library                              |
| [0016](0016-mobile-onboarding-tour.md)             | Mobile first-run onboarding tour + per-screen help                                  |
| [0017](0017-self-hosted-telemetry.md)              | Self-hosted crash reporting and analytics, not Firebase or Sentry SaaS              |
| [0018](0018-user-display-name-and-signup.md)       | User display name + `isNewUser` signal on OTP verify                                |
| [0019](0019-api-security-posture.md)               | Security headers yes, permissive CORS deliberately no                               |
