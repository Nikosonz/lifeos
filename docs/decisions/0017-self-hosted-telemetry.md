# ADR-0017: Self-hosted crash reporting and analytics, not Firebase or Sentry SaaS

## Status

Accepted

## Date

2026-07-27

## Context

The mobile app currently has **no crash reporting and no analytics of any kind** — not even
a global Flutter error handler (`main.dart` sets neither `FlutterError.onError` nor
`PlatformDispatcher.instance.onError`, so an uncaught async error is silently swallowed and
an uncaught build error only shows Flutter's default red/grey error screen, logged nowhere).
The product roadmap (`docs/roadmap.md`, Phase 7) wants both.

ADR-0014 already settled the adjacent question of push notifications: distribution is Cafe
Bazaar and Myket, not Google Play, and a meaningful share of target devices **lack Google
Play Services (GMS) entirely**. That ADR's Decision section states the constraint broadly —
"No GMS-dependent package (`firebase_messaging`, `google_mobile_ads`, or anything else that
pulls in Google Play Services) is added to `mobile/pubspec.yaml`" — and its rejection of
Firebase Cloud Messaging is explicit that missing GMS causes crashes, not graceful
degradation: "the underlying GMS client libraries can cause crashes or silent failures on
ROMs without GMS at all, not just a missing feature." `firebase_crashlytics` and
`firebase_analytics` both transitively depend on `firebase_core`, which pulls the same GMS
client libraries — the ADR doesn't name them individually, but the mechanism it describes
applies to them exactly as it applies to `firebase_messaging`.

## Decision

**Self-hosted telemetry on our own `/api/v1` backend**, not a third-party SaaS product.

- A new `packages/core/src/telemetry/` module, `/api/v1/telemetry/{crashes,events}`,
  following this repo's standard Module Pattern (repository, service, `container.ts`,
  contracts schema, thin route).
- Mobile gets a global error handler for the first time — `FlutterError.onError` +
  `PlatformDispatcher.instance.onError` inside `runZonedGuarded`, per Flutter's own
  documented pattern for catching both framework and async errors.
- Crash reports buffer to local disk and flush on next app launch, since the process that
  just crashed usually can't complete a network call itself.
- Analytics is a small typed event enum, batched client-side before sending — deliberately
  not free-form string events, so the wire contract stays a real `packages/contracts`
  schema instead of an untyped bag.
- Opt-out lives in the Settings screen (ADR-0018/Phase 6) and is disclosed in the privacy
  policy (also Phase 6) — this is the first time the app sends anything beyond what's
  strictly required to function, so the policy page ships before or alongside this, not after.

## Alternatives Considered

### Firebase Crashlytics + Firebase Analytics

- Pros: Industry-standard, zero backend work, excellent stack-trace symbolication and
  crash-grouping UI, free tier.
- Cons: Requires `firebase_core`, which requires Google Play Services on Android. ADR-0014
  already rejected this class of dependency for exactly this app, on exactly this
  reasoning — adding it here would directly contradict a standing decision without
  revisiting it, which ADR-0014's own Consequences section requires before any GMS-dependent
  package is added.
- Rejected: same reasoning as ADR-0014, extended from push messaging to crash/analytics SDKs.

### Sentry (`sentry_flutter`)

- Pros: `sentry_flutter` genuinely has no GMS dependency, so it doesn't trip ADR-0014's
  constraint. Far less implementation work than self-hosting — no new backend module, real
  stack-trace symbolication, breadcrumbs, release tracking, a mature dashboard.
- Cons: `sentry.io`'s reachability from Iran is unverified from this dev machine and this is
  exactly the class of failure this project has hit repeatedly with other external services
  (`registry.npmjs.org`, `dl.google.com`, Vercel, Common Crawl — see CLAUDE.md's Environment
  Constraints). Self-hosting Sentry is the fallback, but it's a genuinely heavy ops
  footprint (its own Postgres/Redis/Kafka-class stack) to run on a VPS that doesn't exist
  yet (Stage C is still unprovisioned per the `deployment` skill).
- Rejected for now: the dependency itself is safe under ADR-0014, but the reachability risk
  and the ops cost of self-hosting make it worse than building a much smaller endpoint on
  infrastructure (Postgres + Next.js API routes) this project already runs and controls.
  Revisit if Stage C's VPS lands and `sentry.io` reachability from Iran is confirmed stable.

### No telemetry at all (status quo)

- Pros: Zero cost, zero privacy surface, zero new code.
- Cons: The app has shipped to a real emulator and is heading toward Cafe Bazaar/Myket with
  no visibility into crashes or usage in the field — the same blind spot CLAUDE.md's Known
  Limitations already documents for the backend ("No metrics/tracing/alerting
  infrastructure yet ... deliberately deferred, not an oversight. There's no deployed
  backend ... yet"). That backend-side deferral was reasonable because there was nothing to
  observe; the mobile app is closer to real users and the same deferral stops being
  reasonable once a real store listing exists.
- Rejected: the product roadmap explicitly wants this; deferring further only makes sense if
  telemetry itself were unsafe or infeasible, which self-hosting solves.

## Consequences

- `packages/core/src/telemetry/` becomes a genuinely new module with its own Prisma models
  (crash reports, event batches) — sync-ready fields per CLAUDE.md's Module Pattern, even
  though telemetry data itself has no cross-client sync need; consistency with every other
  model beats a one-off exception.
- Crash data volume is bounded by this app's real user count, which is small — no need for
  the ingestion-pipeline concerns (Kafka, sampling, retention policies) a Sentry-scale
  system would need. Revisit storage/retention only if volume becomes a real problem.
- `mobile/pubspec.yaml` gains no GMS-dependent package; this ADR is itself the required
  "revisit ADR-0014 before adding a GMS package" checkpoint for telemetry specifically, and
  the answer is: don't add one.
- The privacy policy (Phase 6) must accurately describe this — crash reports and typed
  usage events sent to our own backend, opt-out available, no third-party processor.
