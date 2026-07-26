# ADR-0016: Port web's onboarding tour + per-page help to mobile, content hardcoded not i18n

## Status

Accepted

## Date

2026-07-26

## Context

`mobile/lib/` had zero onboarding/help infrastructure — confirmed by grepping for "tour"/"guide"/"tutorial"/"help" across the codebase before this change. The web app already solved exactly this problem: `OnboardingTour` (a first-run spotlight walkthrough of the sidebar nav, the per-page help button, and logout) paired with `PageHelp` (a "?" icon opening a dialog with a short bulleted explanation of the current page), both built on a `lifeos:onboarding-tour-seen` localStorage flag and a `HelpGuide` content namespace. The mobile app, being the newer, less-explored client, needed the same first-run guidance web already has.

Two structural differences from web shaped the port rather than a literal copy:

- **No local persistence existed on mobile.** `pubspec.lock` had zero key-value storage packages (no `shared_preferences`, `hive`, `sqflite`) — mobile had never needed to remember anything across restarts before.
- **Mobile has no i18n system.** Every string in `mobile/lib/` is a hardcoded Persian literal (the app is fa-only, no locale switching, unlike web's fa/en). Web's `HelpGuide` namespace lives in `next-intl` message files; mobile has no equivalent namespace to put content in.

## Decision

**Persistence**: added `shared_preferences` (official Flutter-team package, no Google Play Services dependency — safe under ADR-0014's Cafe Bazaar/Myket constraint) as the first local-storage dependency mobile has ever needed. `main.dart` awaits `SharedPreferences.getInstance()` before `runApp()` and overrides a `sharedPreferencesProvider` with the real instance — the standard Riverpod pattern for an async-initialized, startup-only dependency. `tutorialSeenProvider` reads/writes the literal key string `lifeos:onboarding-tour-seen`, matching web's localStorage key name exactly (the two stores are physically separate — device SharedPreferences vs. browser localStorage — this is purely for grep-ability across the repo, not shared state).

**Help content**: `PageHelpButton` (`lib/src/ui/widgets/page_help_button.dart`) is web's `PageHelp` ported to Flutter, but mounted **once** in `AppShell`'s `AppBar`, re-keyed off the active bottom-nav destination — not one call site per page/route the way web's 12 separate `<PageHelp pageKey="x" />` instances are, since mobile's five module screens already share one `AppShell`/`AppBar`. Content lives in `lib/src/nav/module_help_content.dart` as hardcoded Persian string literals, resolved via an exhaustive `switch` over `ModuleKey` rather than a `Map` (a code-review pass found the original `Map` version needed a force-unwrap at its one call site, since `ModuleKey` has a sixth value — `notifications` — that is deliberately not a bottom-nav destination; the analyzer now refuses to compile if a future `ModuleKey` value is added without a decision made here), condensing web's per-sub-page `HelpGuide` entries into one dialog per module — e.g., Finance's dialog covers what web splits across Dashboard/Wallets/Categories/Transactions/Budgets, since those are tabs in one mobile screen, not five separate routes. **No i18n/ARB system was introduced** — that would be unrelated infrastructure scope this feature doesn't need, and would be the first such system in a codebase that has never had one.

**Manual replay**: the tour originally only ever showed automatically, once, gated by `tutorialSeenProvider` — there was no way back in once dismissed. Added a "نمایش راهنما" overflow-menu item (first entry, above "دستگاه‌های فعال") that bumps a new `tourRestartSignalProvider` (a plain `StateProvider<int>` counter). `OnboardingOverlay` listens for that counter changing (`ref.listen`, not `ref.watch`) and re-activates itself — deliberately without touching the persisted seen flag, so replaying never un-marks the tour as seen for the auto-show-on-first-login path. This required decoupling the overlay's build-time visibility gate from `tutorialSeenProvider` entirely (it's now consulted only once, in `initState`, to decide the _automatic_ first-show) — the original code also gated `build()` on `ref.watch(tutorialSeenProvider)`, which would have permanently suppressed any replay once the flag flipped true.

**First-run tour**: `OnboardingOverlay` (`lib/src/ui/onboarding/onboarding_overlay.dart`) ports web's spotlight technique — a CSS `box-shadow: 0 0 0 9999px rgba(0,0,0,.6)` cutout — via Flutter's `BoxShadow.spreadRadius`, which produces the identical visual effect (a huge shadow spread fills everything outside a target rect, leaving the rect itself unshadowed) without needing a `CustomPainter`. Five steps (welcome, bottom nav, notification bell, help button, overflow menu) mirror web's four (welcome, sidebar nav, page-help button, logout), adapted since mobile has no persistent sidebar and moves logout behind an overflow menu rather than a standing button. The tooltip-positioning clamp math (avoiding the exact "very tall target pushes the card off-screen" bug CLAUDE.md documents web having hit and fixed) was ported directly rather than rediscovered. Mounted once inside `AppShell.build()` as a `Stack` layer over the `Scaffold`, gated by `tutorialSeenProvider`, showing itself ~1.5s after mount — same delay, same reason (letting the shell finish laying out before measuring targets).

## A real bug this surfaced

Building the spotlight cutout hit a genuine Flutter framework rule, not a design question: `Positioned`/`AnimatedPositioned` only apply their geometry when they are a **direct** child of a `Stack` — wrapping the spotlight's `AnimatedPositioned` in a `GestureDetector` (to make the dimmed area tap-to-dismiss) silently broke it. Flutter threw `Incorrect use of ParentDataWidget` on every step, caught by the framework and logged rather than crashing the screen, so the failure was invisible in manual testing (no red error screen, just a slightly-wrong-looking dim with no visible cutout) and only surfaced by checking the running app's console log directly. Fixed by moving the tap-to-dismiss `GestureDetector` to its own separate `Positioned.fill` layer beneath the spotlight box, with the spotlight box wrapped in `IgnorePointer` so a tap on the spotlighted area itself still falls through and dismisses (matching web's "click the backdrop or spotlight area closes the tour early" behavior). Verified fixed by inspecting the live emulator screenshot at each of the 5 steps, not just by the absence of analyzer/test errors — this class of bug (correct types, correct build, wrong visual result) doesn't show up in `flutter analyze`/`flutter test` at all.

## Alternatives Considered

### A third-party coach-mark package (`tutorial_coach_mark`, `showcaseview`)

- Pros: Battle-tested spotlight/positioning logic, less code to write and maintain.
- Rejected: Web already has a working, debugged spotlight implementation (including the tall-target clamping fix) that this port could reuse directly — pulling in a new dependency to solve a problem already solved in this codebase would be redundant, and would introduce an unfamiliar API surface for a small, self-contained piece of UI.

### Set up mobile i18n now, author `HelpGuide` content there

- Pros: Matches web's actual architecture exactly; would position mobile for future locale support.
- Rejected: Mobile has never needed i18n (fa-only, no locale switching anywhere in the app), and introducing an ARB/`intl`-message pipeline as a side effect of an onboarding feature would be a disproportionate, unrelated infrastructure change. Every other string in `mobile/lib/` is already a hardcoded Persian literal; matching that existing convention is the smaller, more consistent choice. Revisit if/when mobile actually needs a second locale.

### One `PageHelpButton` instance per module screen file (matching web's one-per-route pattern literally)

- Pros: Structurally identical to web, most "obvious" 1:1 port.
- Rejected: Mobile's five module screens already share one `AppShell`/`AppBar` — web needs 12 separate instances because it has 12 separate routes/files; mobile has one AppBar to put the button in regardless of which module is active. Keying one shared instance off the active destination is less code and can't drift between screens the way 5+ independent call sites could.

## Consequences

- `shared_preferences` is now mobile's first local-persistence dependency — any future "remember this across restarts" feature (a saved filter, a dismissed banner) should reuse `sharedPreferencesProvider` rather than adding a second storage mechanism.
- The tour and help content are hardcoded Persian strings, consistent with the rest of the app — if mobile ever gains a second locale, this content (along with every other hardcoded string in `mobile/lib/`) needs to move into whatever i18n system gets introduced at that point; this ADR doesn't block that, it just doesn't build it prematurely.
- `test/onboarding_test.dart` establishes the pattern for testing anything gated on `tutorialSeenProvider`: override `sharedPreferencesProvider` with a real instance from `SharedPreferences.setMockInitialValues(...)`, and override `authControllerProvider`/`notificationsProvider` with fakes to reach the authenticated shell without a real network call.
- Any future full-screen spotlight/overlay widget in this app should route its dismiss-tap handling through a separate `Positioned.fill` layer, not wrap the positioned content itself in a `GestureDetector` — the bug documented above is a general Flutter `Stack` rule, not specific to this feature.
