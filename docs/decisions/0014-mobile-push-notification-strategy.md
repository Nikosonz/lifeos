# ADR-0014: Poll for mobile notifications now, defer real push to a non-GMS provider

## Status

Accepted

## Date

2026-07-25

## Context

The web app's Notifications module (ADR-0009, ADR-0011) delivers in-app notifications the user sees on their next page load or manual refresh — there is no push channel today for any client. Distribution for the mobile client is Cafe Bazaar and Myket (ADR-0012), not Google Play, because Google Play is largely unavailable to Iranian developers and users. A large fraction of the Android devices this app will actually run on **lack Google Play Services (GMS) entirely** — Firebase Cloud Messaging, the standard cross-platform push mechanism Flutter apps normally reach for (`firebase_messaging`), requires GMS and is unreliable-to-absent on exactly the devices this app targets.

## Decision

**No push notifications in this pass.** The mobile Notifications screen
(`mobile/lib/src/notifications/notifications_providers.dart`) polls `GET
/api/v1/notifications` every 30 seconds via a `Timer.periodic` inside its
`AsyncNotifier`, active only while something is actually watching the
provider (torn down by Riverpod's `autoDispose` the moment the
Notifications screen and the drawer's unread badge both stop watching it)
— an MVP-appropriate "poll now" strategy, not a permanent one. No
GMS-dependent package (`firebase_messaging`, `google_mobile_ads`, or
anything else that pulls in Google Play Services) is added to
`mobile/pubspec.yaml`.

## Alternatives Considered

### Firebase Cloud Messaging (the default Flutter push story)

- Pros: Best-documented, most Flutter tutorials assume it, minimal app-side integration work.
- Cons: Requires Google Play Services, which a meaningful share of this app's actual target devices (Cafe Bazaar/Myket users, per ADR-0012) don't have. Shipping an FCM dependency wouldn't just "degrade gracefully" on those devices — the underlying GMS client libraries can cause crashes or silent failures on ROMs without GMS at all, not just a missing feature.
- Rejected: Directly contradicts the distribution decision already made in ADR-0012. Revisit only if Google Play ever becomes the primary distribution channel for this app, which is not the current plan.

### An Iran-native push provider now (Cafe Bazaar Pushe / Myket push)

- Pros: Solves the actual problem — real push, no GMS dependency, works on the target devices.
- Cons: Adds a new backend integration (an outbound push-sending path from `apps/worker` or `packages/core`) at a point where `apps/worker` is still a documented placeholder (CLAUDE.md's Known Limitations) with no real jobs wired up yet, and the mobile client itself is only now getting its first working build. Building push infrastructure before the app it's for has shipped a single notification via any channel is premature.
- Rejected for now, not rejected permanently: this is the intended real solution, deferred until `apps/worker` is production-ready and the mobile app has real users to justify it — see Consequences.

### WebSocket / Server-Sent Events for near-real-time in-app updates

- Pros: Lower latency than 30s polling, works without any push provider, no GMS dependency.
- Cons: Requires a persistent connection the app must manage through Android's background-execution restrictions (Doze mode, background service limits) — meaningfully more implementation and battery-management complexity than a timer that only runs while a screen is visible, for a life-management app where a notification arriving 30 seconds late (a budget-exceeded alert, a habit reminder) has no real cost.
- Rejected: The cost/benefit doesn't justify it for this app's actual notification types (see CLAUDE.md's Notification module — currently only `FINANCE_BUDGET_EXCEEDED`, all non-urgent).

## Consequences

- The Notifications screen's polling costs one small `GET` request per 30 seconds while visible or while the drawer's unread badge is on screen — acceptable for a personal finance/productivity app, but this is a real, intentional trade-off against battery/data usage that should be revisited if usage patterns show it's meaningfully costly in practice.
- A notification created server-side is invisible to a mobile user until their next poll tick (up to 30s) or app foreground — there is no "instant" delivery path today, unlike a true push notification. Document this expectation anywhere user-facing copy implies immediacy.
- `mobile/pubspec.yaml` must not gain a GMS-dependent package without revisiting this ADR — this is now an explicit constraint on future dependency additions, not just an oversight to avoid.
- When `apps/worker` becomes production-ready (see CLAUDE.md's Known Limitations), integrating Cafe Bazaar Pushe or Myket push is the documented next step — it replaces the polling timer, not the notification data model itself (which stays exactly as-is; only the delivery mechanism changes).
