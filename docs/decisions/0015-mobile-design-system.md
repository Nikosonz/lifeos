# ADR-0015: A token/component design system for mobile, and a 5-item bottom nav over the 6-item drawer

## Status

Accepted

## Date

2026-07-26

## Context

A request to redesign the mobile app's UI (drawing on FotMob — widely
regarded as one of the best-designed Android apps — for design-principle
inspiration, not its assets or layouts) led to a design-system audit of
`mobile/lib/src/`. The audit found the gap between this app and a
polished one wasn't primarily color or iconography — it was structural:

- **Zero shared widgets.** Every one of 13 list screens hand-rolled its
  own `provider.when(loading:, error:, data:)` block.
  `Center(child: Text('خطا: $e'))` interpolated the raw exception into
  user-facing Persian UI with no retry button, on every single one.
  Empty states were a bare centered sentence with no icon, no hint, and
  critically no CTA — even on screens that had a FAB for the exact same
  action right there.
- **A 19-line theme.** `buildAppTheme()` set only a `ColorScheme.fromSeed`
  and flat `AppBarTheme`/`NavigationDrawerTheme` — no `textTheme`,
  `cardTheme`, `listTileTheme`, `chipTheme`, `dividerTheme`, or spacing
  scale. The same visual relationship (a stat card's label-to-value gap,
  a section header's top margin) had a different hardcoded pixel value
  on every screen that used it, because nothing constrained it to one.
- **Three parallel color systems**, one of them already dead code:
  `module_colors.dart` (the _intended_ system, matching the web's
  per-module accents) was called from exactly one file — the old
  drawer's icon tinting — everywhere else used raw `Colors.green`/`.red`/
  `.grey`/`.deepOrange` literals or a second, Tasks-only system
  (`task_labels.dart`'s Material-constant status/priority colors).
- **Two typography systems side by side** — `textTheme.*` covered four
  roles; hardcoded `TextStyle(fontSize: 11/12/13/22)` covered the rest,
  with no shared scale reconciling them.

Separately, FotMob's most consistently praised trait across the sources
reviewed (design critiques, UX case studies, App Store sentiment) is its
5-item bottom navigation bar — always visible, one thumb-tap to any
section, the active tab highlighted by a single consistent accent. The
mobile app's `NavigationDrawer` existed specifically because six modules
exceed Material's own recommended 5-item bottom-nav maximum (the original
`app_shell.dart`'s own comment says as much) — a drawer hides all six
destinations behind a hamburger at rest, the opposite of what made
FotMob's navigation work.

## Decision

**Token + component layer**, not a wholesale rewrite:
`lib/src/theme/tokens/` (`Spacing`, `AppShape`/`AppRadius`,
`AppTypography`, `AppMotion`) plus `lib/src/theme/semantic_colors.dart`
(an `AppColors` `ThemeExtension` finally porting the web's
`--income`/`--expense` tokens to mobile) and `lib/src/ui/widgets/`
(`AsyncValueView`, `ErrorState`, `EmptyState`, `AppScaffold`, `MoneyText`,
`MonthStepper`, `StatCard`, `SectionHeader`, `AppListRow`). `app_theme.dart`
grew from 19 lines to a full `ThemeData` wiring every one of the above
into `textTheme`/`cardTheme`/`listTileTheme`/`chipTheme`/`dividerTheme`/
`inputDecorationTheme`/`navigationBarTheme`.

Two screens (`dashboard_tab.dart`, `habits_home.dart`) were refactored
onto the new components as a pilot and verified live on the emulator —
proof the system works against real screens, not just in isolation — with
the remaining 11 screens left as a documented migration checklist (see
the `mobile` skill) rather than swept in the same change. This keeps the
diff reviewable and lets the look be judged before committing everywhere.

**Navigation**: the `NavigationDrawer` is replaced with a 5-item bottom
`NavigationBar` (Finance/Tasks/Habits/Calendar/Reports) built on
go_router's `StatefulShellRoute.indexedStack` (preserves each branch's
own navigation state when switching tabs, unlike a plain route swap).
Notifications moves to an AppBar bell with an unread badge — a
near-universal mobile convention for a read-and-dismiss feed, freeing the
fifth slot without violating Material's 5-item guidance the original
drawer was built to respect. Sessions (device management) and logout
move to an AppBar overflow menu. `NotificationsHomeScreen` gained its own
`AppBar` (it previously had none, relying entirely on the shell's) since
it's now a pushed route outside the shell, not a shell branch.

## Alternatives Considered

### Keep the drawer, redesign only visuals

- Pros: Zero information-architecture risk; smallest possible diff.
- Rejected: The audit and the FotMob research point at the same root
  cause from two directions — a drawer's "all destinations equal weight,
  none visible at rest" structure is precisely what the most-cited
  praise for FotMob's navigation is praising the _absence_ of. Restyling
  the drawer would leave the actual navigational weakness in place.

### Bottom nav with a 6th "More" overflow destination

- Pros: Keeps all six modules reachable from the bottom bar, including
  Notifications as a real destination rather than a bell.
- Rejected: A Pratt Institute design critique of FotMob's own Android
  app (cited in the research for this ADR) flags exactly this pattern —
  two competing menus (top-right icons vs. a bottom "More") — as FotMob's
  single worst discoverability flaw, causing users to hit "the gulf of
  execution" over which menu holds which option. Copying the pattern
  FotMob itself is criticized for would be a regression dressed as a
  redesign.

### Full 13-screen refactor in one pass

- Pros: Maximum consistency payoff immediately; no interim state where
  some screens use the new components and others don't.
- Rejected: A single diff touching every UI file in the app is much
  harder to review and re-verify than tokens + components + a 2-screen
  proof, and risks shipping a visual direction across the whole app
  before it's been seen running for real. The migration checklist in the
  `mobile` skill exists so the remaining screens aren't lost track of.

### Jetpack Compose / native rewrite

- Pros: Full Material 3 Expressive support (physics-based motion,
  expanded type scale) — Flutter's `material`/`cupertino` packages are
  not currently implementing M3 Expressive; the Flutter team paused that
  work pending a package split, with community estimates of years before
  it lands in the SDK.
- Rejected outright, not just for this pass: ADR-0012 already chose
  Flutter specifically for cross-platform reach toward iOS/desktop from
  one codebase. A Compose rewrite throws that away for a design-system
  update that doesn't require it — every gap this ADR addresses (shared
  widgets, a real theme, consistent tokens) is a Flutter-side application
  problem, not something native Android solves that Flutter can't.

## Consequences

- `moduleColor()` goes from effectively dead code (one call site) to
  meaningfully used: the bottom nav's _selected_ icon, `AppListRow`'s
  leading icon chip, `EmptyState`'s icon badge, and `StatCard`/`MoneyText`
  wherever a screen passes a `ModuleKey`. Deliberately _not_ used for
  every nav icon regardless of selection state — a bottom nav's own
  Material selection indicator is the primary "which tab am I on"
  signal, and 5 simultaneous accent hues would compete with it rather
  than reinforce it (the opposite of FotMob's one-consistent-accent
  active-tab pattern).
- `flutter_lints` + `flutter analyze` catch API drift immediately in this
  Flutter/Dart version (e.g. `AppBarTheme` vs. `AppBarThemeData` — a
  recent Flutter split between the old `InheritedTheme` widget class and
  the new plain-data class `ThemeData.appBarTheme` actually expects,
  caught this way while writing `app_theme.dart`) — same "run
  analyze/test after any change" discipline the `mobile` skill already
  documents for Riverpod 3.
- The remaining 11 screens (plus `task_labels.dart`'s color system) stay
  on the pre-redesign patterns until migrated — see the `mobile` skill's
  checklist. A screen not yet migrated still works; it just doesn't
  benefit from the shared error/empty states or consistent spacing yet.
- Income/expense colors (`AppColors.light`/`.dark`) are a real
  OKLCH→sRGB conversion of the web's `--income`/`--expense` tokens (same
  formula already verified against `module_colors.dart`'s existing
  values), not eyeballed hex — dark-mode variants are hand-tuned for
  legibility since the web itself is light-only and has no dark-mode
  reference to port.
