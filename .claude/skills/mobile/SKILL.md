---
name: mobile
description: Use when touching mobile/ (the Flutter/Android client) — adding a module screen, regenerating Dart models from contracts, or diagnosing an Android/Gradle/emulator build failure. Mirrors telegram/mcp's thin-client rule, plus everything specific to Flutter/Dart/Android and this dev machine's network constraints.
---

# LifeOS mobile (Flutter/Android)

`mobile/` is the second real client after the web app, proving CLAUDE.md's
founding thesis: "the website is only Client #1." It is Dart, not an npm
workspace — sits at the repo root, outside `apps/*`/`packages/*`.

## The one rule that matters most

**A new client is a new surface, never a new copy of business logic**
(same rule `telegram`/`mcp` document). The Flutter app fetches, renders,
and sends. It never computes a balance, a streak, a budget's remaining
amount, or a Jalali month boundary — every derived number is rendered
exactly as `/api/v1` returned it. If a screen needs data the API doesn't
expose yet, add the route in its owning backend module first (see
`backend-architecture`), then consume it — don't reach for a client-side
shortcut.

## Contract-generation pipeline — the load-bearing decision

Dart cannot import `packages/contracts`'s Zod schemas the way a TS client
can, so hand-writing Dart DTOs across six modules would guarantee the
exact drift the web's runtime `.parse()` exists to catch. Instead:

**`packages/contracts/scripts/generate-dart-models.mjs`** walks every
`packages/contracts/src/<module>/schemas.ts` export whose runtime shape is
an object/enum/discriminated-union (via Zod v4's own `.def.type`
introspection — `def.type` is `'object'`/`'enum'`/`'union'`/`'string'`/etc,
readable directly off any schema instance), and emits one typed Dart file
per module into `mobile/lib/src/generated/`. Exports named `*Query` are
skipped (query params are built as plain `Map<String, dynamic>` in each
repository, not worth a formal type). Regenerate after any contract change:

```
npm run generate:dart -w @lifeos/contracts
cd mobile && dart format lib/src/generated/   # ← not optional, see below
```

**Adding a new contracts module?** The generator has a hardcoded
`MODULES` list (and a matching `import * as ...` line) near the top of
`generate-dart-models.mjs`. A new `packages/contracts/src/<module>/schemas.ts`
emits **nothing at all** until it is registered there — no error, no warning,
just a missing file. Hit when telemetry was added.

**Always run `dart format lib/src/generated/` immediately after
generating.** The generator emits unwrapped single-line expressions; the
committed files are `dart format`-wrapped at 80 columns. Skip the format
step and `git diff` shows all 7 module files rewritten with hundreds of
pure-whitespace changes, burying whatever actually changed — a one-field
contract edit looked like a 580-line diff across every module until the
formatter was run, at which point it collapsed to the 83 real lines in
`auth_models.dart`. Do not go hunting for a generator bug when this
happens; run the formatter first.

**One subtlety worth knowing when you add a `.nullable().optional()`
field**: the generator resolves that combination to the _nullable_
serialization rule — the key is always written, because an explicit
`null` is meaningful ("clear this value"). Plain `.optional()` fields are
omitted when null ("leave unchanged"). That is exactly the wire contract
`UpdateProfileInput.name` needs, so the generated `toJson` can be used
directly rather than hand-building a map at the call site.

**This is a custom generator, not `openapi-generator-cli`** — a deliberate
deviation from the original roadmap plan (see `docs/decisions/` for the
ADR). `openapi-generator-cli` needs a JDK 11+ and downloads its generator
jar from Maven Central, both extra fragile dependencies on this
network-constrained dev machine (see "Iran network constraints" below);
the custom script only needs Node + the `zod` package already in
`node_modules`, and can encode this codebase's exact conventions (money as
`String`, not `double`; `DateTime` for `.datetime()` strings; discriminated
unions as Dart `sealed class` hierarchies) precisely instead of fighting a
generic generator's defaults.

**Non-obvious things the generator does that make the output actually
usable:**

- **Discriminated unions get shared base-class getters.** A Zod
  `z.discriminatedUnion` like `CalendarItemResponse` becomes a `sealed
class` in Dart; TypeScript lets you read a field common to every branch
  (`item.title`) before narrowing, but a naive Dart translation can't —
  each variant would only have its own fields. The generator computes the
  fields shared by literally every variant (same JSON name **and** same
  resolved Dart type) and hoists them onto the sealed base as abstract
  getters (`String get title;`), with each variant's own field marked
  `@override`. Skipping this means any code touching a union's common
  fields fails to compile until you switch on the variant first.
- **Money stays `String`, never `double`** — `MoneyAmountInput`/
  `SignedMoneyAmount` are regex-checked strings server-side specifically to
  avoid float precision loss (see CLAUDE.md's Money conventions); the
  generator's type-mapping never routes a `string`-typed Zod schema to
  Dart `double`, regardless of what the string's regex looks like.
- **Enum members are named to match the wire value exactly**
  (`TaskStatus.IN_PROGRESS`, not `inProgress`), so `.name` round-trips
  through `fromJson`/`toJson` with no lookup table — the generated files
  carry `// ignore_for_file: constant_identifier_names` for this reason,
  not as a blanket suppression.
- **A discriminated union's own variant types are only emitted once** — a
  variant (e.g. `CalendarEventItemResponse`) is usually _also_ a separate
  named export in the schema file; the generator tracks which schemas got
  consumed as union options and skips re-emitting them as plain classes.

**When extending the generator**, the fastest way to understand a new Zod
construct's runtime shape is to inspect it directly rather than guess:

```js
import { z } from "zod";
const s = z.object({ x: z.string().nullable() });
console.log(s.def.shape.x.def); // { type: 'nullable', innerType: ZodString {...} }
```

`optional`/`nullable`/`default` are unwrap-loop wrappers (peel with
`.def.innerType`, OR-ing Dart nullability); `.superRefine()` does **not**
change `.def.type` or wrap the schema, so refined objects/unions are still
plain `ZodObject`/`ZodDiscriminatedUnion` for introspection purposes.

## Riverpod 3 is not Riverpod 2 — real gotchas hit building this

This app uses `flutter_riverpod: ^3.3.2`, whose class-based provider API
changed in ways that silently don't match Riverpod 2 tutorials/memory:

- **`WidgetRef` and `Ref` are unrelated types** (`WidgetRef implements
BaseWidgetRef`, `Ref implements BaseRef` — two separate interfaces, no
  shared supertype). A helper function meant to be called from both a
  widget's `onPressed` and a `Notifier`'s internal method needs two
  signatures, or just pick whichever one every real call site actually
  uses (usually `WidgetRef`, since most mutations are triggered from UI
  callbacks).
- **`AsyncValue.value` replaces `.valueOrNull`** — `.valueOrNull` doesn't
  exist in 3.x; the nullable-getter is just `.value`.
- **`StateProvider` moved to `package:flutter_riverpod/legacy.dart`** —
  not removed, just no longer in the main barrel export. Fine to keep
  using for simple local UI state (a month-nav cursor, a filter chip
  selection) that doesn't warrant a full `Notifier` class; import the
  `legacy.dart` explicitly when you reach for it.
- **A family `AsyncNotifier` takes its arg via the constructor, not a
  `build(arg)` parameter.** There is no `FamilyAsyncNotifier<T, Arg>` base
  class to extend. Instead:
  ```dart
  class TasksController extends AsyncNotifier<TaskPage> {
    final TaskStatus? status;
    TasksController(this.status);
    @override
    Future<TaskPage> build() => repo.listTasks(status: status);
  }
  final tasksProvider = AsyncNotifierProvider.autoDispose
      .family<TasksController, TaskPage, TaskStatus?>(TasksController.new);
  ```
  Functional families (`FutureProvider.autoDispose.family<T, Arg>((ref,
arg) => ...)`) are unaffected — this only applies to class-based
  Notifier/AsyncNotifier families.
- **Invalidating one family member isn't enough after a mutation that can
  move an item between filters.** A task's status edit (TODO → DONE)
  affects the "all" list AND both filtered lists; invalidate the whole
  family (`ref.invalidate(tasksProvider)`, not `ref.invalidate(
tasksProvider(status))`) after any mutation that could change which
  filter(s) an item belongs under.

## Dart 3 pattern-matching gotcha (not Riverpod-specific)

A `switch` on a `sealed class` only promotes a **local variable's** static
type within each arm — not a field/getter re-accessed via `this.foo` or
`widget.foo`. Bind to a local first:

```dart
final item = this.item; // NOT optional — promotion needs the local
return switch (item) {
  CalendarEventItemResponse() => Text(item.eventId), // only compiles via the local
  ...
};
```

Switching on `this.item` directly and then reading `item.eventId` inside
the arm fails to compile — the type-checker still sees the base sealed
type at that access, even though the switch pattern matched.

## Architecture — mirrors the web's structure, adapted to Flutter idioms

Per-module: `lib/src/<module>/<module>_repository.dart` (thin `ApiClient`
wrapper, one method per route — no business logic), `<module>_providers.dart`
(Riverpod providers/controllers), `lib/src/ui/<module>/` (screens/dialogs).
`lib/src/shared/format_jalali.dart` / `format_money.dart` port the web's
`format-jalali.ts`/`format-money.ts` display-only conversions **exactly**
(same fixed `+03:30` Tehran offset, no DST — see `lifeos-domain`), verified
against the same Nowruz-1403 reference instant CLAUDE.md documents for the
server (`test/format_jalali_test.dart`). `lib/src/nav/app_shell.dart` +
`lib/src/router.dart` (go_router's `StatefulShellRoute.indexedStack`) are
the Dart analog of the web's `AppShell`/`Nav` — a 5-item bottom
`NavigationBar` (Finance/Tasks/Habits/Calendar/Reports) plus Notifications
as an AppBar bell with an unread badge, replacing the original 6-item
`NavigationDrawer` (see ADR-0015 and "Design system" below for why). Tabs
_within_ a module screen still handle its sub-pages (Finance: Dashboard/
Wallets/Categories/Transactions/Budgets; Tasks: Tasks/Projects/Labels),
unchanged from before.

**Auth**: `lib/src/auth/token_store.dart`'s `TokenStore` interface branches
on `Platform.isAndroid` (`providers.dart`) — `SecureTokenStore`
(`flutter_secure_storage`, Android Keystore-backed) on Android,
`InMemoryTokenStore` everywhere else (Windows dev builds, the test
harness). `lib/src/api/api_client.dart`'s `AuthInterceptor` is a
line-by-line Dio port of the web's `apiFetch` 401-refresh-rotation logic
(de-duped concurrent refresh, one retry, clear+logout on failure).

## Design system (2026-07-26, ADR-0015)

A design-system audit (triggered by a FotMob-inspired redesign request)
found the original UI had **zero shared widgets** — every screen hand-
rolled its own loading/error/empty state, `Center(child: Text('خطا: $e'))`
leaked the raw exception into user-facing Persian UI 13 times with no
retry button, the theme was 19 lines (no `textTheme`/`cardTheme`/
`listTileTheme`/spacing tokens), and the same visual relationship (e.g. a
stat card's label-to-value gap) used a different pixel value per screen.
Fixed with a token + component layer under `lib/src/theme/tokens/` and
`lib/src/ui/widgets/` — import the latter via the barrel
`lib/src/ui/widgets/widgets.dart`.

**Tokens** (`lib/src/theme/tokens/`): `Spacing` (4dp-base scale — `xs`
through `xxl`, plus `rowHeight`/`maxContentWidth`), `AppShape`/`AppRadius`
(ports `--radius-*` from `apps/web/src/app/globals.css`), `AppTypography`
(one type scale + `tabular()` for money/stat columns), `AppMotion`
(duration/curve pairs — `instant`/`quick`/`standard`, no bounce). Every new
`EdgeInsets`/`SizedBox`/`BorderRadius`/`TextStyle`/`Duration` should
reference one of these, not a raw number.

**`lib/src/theme/semantic_colors.dart`**: an `AppColors`
`ThemeExtension` porting the web's `--income`/`--expense` tokens (real
OKLCH→sRGB conversion, not eyeballed — `#319751`/`#D33A3C`, same formula
`module_colors.dart` already used) that mobile never had, which is exactly
why `Colors.green`/`Colors.red`/`Colors.grey` were hardcoded 11+ times
across screens instead of coming from one place. Access via
`context.colors.income` (the `AppColorsContext` extension). Also adds
`context.moduleAccent(key)`/`context.moduleAccentSubtle(key)` — thin
wrappers over `module_colors.dart` so call sites don't thread `Brightness`
themselves. **`buildAppTheme()` in `app_theme.dart` is now a full theme**
(textTheme/cardTheme/listTileTheme/chipTheme/dividerTheme/
inputDecorationTheme/navigationBarTheme, all keyed off the tokens above),
not just a `ColorScheme.fromSeed`.

**Components** (`lib/src/ui/widgets/`):

| Widget              | Replaces                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AsyncValueView<T>` | The 13× hand-rolled `provider.when(loading:, error:, data:)` block                                                                                                 |
| `ErrorState`        | `Center(child: Text('خطا: $e'))` — friendly Persian copy per the closed `ApiException.code` set, always a working retry                                            |
| `EmptyState`        | Bare centered `Text('هنوز …نساخته‌اید.')` — module-tinted icon, hint line, real CTA wired to the same handler as the screen's FAB                                  |
| `AppScaffold`       | Per-screen `Scaffold(body: Padding(EdgeInsets.all(16), ...))` — also caps content width on tablets                                                                 |
| `MoneyText`         | Per-screen `formatTomanFromRial()` + hand-picked sign color                                                                                                        |
| `MonthStepper`      | The Jalali month-nav `Row` duplicated 4× (dashboard/reports/budgets/calendar), each with different padding                                                         |
| `StatCard`          | Dashboard's hero balance card and Reports' KPI tiles, previously two near-identical hand-rolled versions with different padding/no value fontSize                  |
| `SectionHeader`     | Bare `Text(..., style: textTheme.titleMedium)` above a list section                                                                                                |
| `AppListRow`        | Bare `ListTile` — adds a module-tinted leading icon chip and turns undiscoverable `onLongPress` delete actions into a visible trailing overflow menu (`RowAction`) |

**Refactored as the pilot** (proving the components against real screens
before a full sweep): `ui/finance/dashboard_tab.dart`,
`ui/habits/habits_home.dart`. Verified live on the emulator: bottom nav
switching, the AppBar bell pushing `/notifications` with its own back
button, `EmptyState`'s CTA, tab-state preservation across navigation.

**Migration checklist — remaining screens** (each: swap to `AppScaffold`

- `AsyncValueView` + `MoneyText`/`AppListRow`/`SectionHeader` as
  applicable, run `flutter analyze`, spot-check on the emulator):

* [x] `ui/finance/wallets_tab.dart`, `categories_tab.dart`,
      `transactions_tab.dart`, `budgets_tab.dart` (2026-07-27) —
      `AppListRow` gained an `accent`/`accentSubtle` override (takes
      precedence over `module`) so Categories/Transactions can color their
      leading icon by income/expense semantics rather than a flat module
      hue; `context.incomeSubtle`/`expenseSubtle` getters added to
      `semantic_colors.dart` alongside a shared `subtleTint()` helper
      `module_colors.dart`'s `moduleSubtle()` now also calls, so both use
      the identical blend formula. Wallets'/Categories' delete action moved
      off `onLongPress` onto a visible `AppListRow` `actions` overflow, the
      same fix the design-system audit already made standard. Live-tested
      end-to-end on the emulator (not just `flutter analyze`/`flutter
    test`), which is what caught two real, pre-existing bugs unrelated to
      styling — see "Bugs found migrating Finance" below.
* [x] `ui/tasks/tasks_tab.dart`, `projects_tab.dart`, `labels_tab.dart`,
      `task_detail_sheet.dart` (2026-07-27)
* [x] `ui/calendar/calendar_home.dart` (2026-07-27)
* [x] `ui/reports/reports_home.dart` (2026-07-27) — reintroduced `StatCard.dense`
* [x] `ui/notifications/notifications_home.dart` (already migrated in an earlier pass),
      `ui/sessions/sessions_screen.dart` (2026-07-27)
* [x] `ui/login_screen.dart` (2026-07-27) — tokens + `ApiException.code` → Persian copy,
      reusing `ErrorState`'s mapping (renamed `friendlyErrorMessage`, made public)
* [x] Shared `confirmDestructive(context, title)` helper (`ui/widgets/confirm_dialog.dart`,
      2026-07-27), replacing 5 duplicated destructive `AlertDialog`s; confirm button uses
      `colorScheme.error`
* [x] **Retire `tasks/task_labels.dart`'s Material-constant color system**
      (`Colors.grey/blue/green/red/blueGrey/orange` for status/priority) to
      `AppColors`/module tokens (2026-07-27) — `taskStatusColor`/`taskPriorityColor` now
      take a `BuildContext` and are theme-driven; fixed a real collision where CANCELLED
      and URGENT were both `Colors.red`.
* [ ] Dialogs (`task_form_dialog.dart`, `event_form_dialog.dart`,
      `habit_form_dialog.dart`, finance's inline dialogs): adopt
      `AppShape`/`Spacing` in their own layout; `dialogTheme` in
      `app_theme.dart` already themes the shell.
* [ ] Nested-`Scaffold` cleanup: `finance_home.dart`/`tasks_home.dart`'s
      `DefaultTabController` wraps tabs that each supply their own inner
      `Scaffold` — a pre-existing issue the pilot's `AppScaffold` swap
      incidentally starts fixing per-screen, not something this pass
      restructured at the `*_home.dart` level.

### Dark mode (2026-07-28)

`darkTheme:` was already wired and `AppColors.dark` genuinely hand-tuned
since the design-system pass — what Phase 4 of `docs/roadmap.md` added
was user control: `themeModeProvider` (`providers.dart`) is a
`Notifier<ThemeMode>` reading `SharedPreferences` synchronously in
`build()`, storing `ThemeMode.name` (not an int index) under
`lifeos:theme-mode` — same shape as `TutorialSeenController`, deliberately
copied rather than reinvented. Read at the **app root**
(`LifeOsApp.build()`, not inside `AppShell`) via
`ref.watch(themeModeProvider)` passed to `MaterialApp.router(themeMode:)`,
so the theme applies to the login screen too, not just the authenticated
shell — this is why `widget_test.dart` (which pumps `LifeOsApp` while
logged out) needed a `sharedPreferencesProvider` override it never
required before; any future test that pumps `LifeOsApp` needs one now.
The toggle itself is three `CheckedPopupMenuItem`s (پیش‌فرض سیستم/حالت
روشن/حالت تیره) added to `AppShell`'s existing overflow `PopupMenuButton`,
above a divider from the pre-existing تور/دستگاه‌ها/خروج items.

**Checking a module accent's contrast against a real Material 3 dark
surface needs the actual seeded `ColorScheme`, not hand-computed
luminance** — `ColorScheme.fromSeed()`'s tonal-palette algorithm (HCT
color space) doesn't reduce to a simple formula, so the only reliable way
to check e.g. `moduleColor(ModuleKey.tasks)` against
`ColorScheme.fromSeed(seedColor: brandLapis, brightness: Brightness.dark)
.surface` is to actually construct that scheme and call
`Color.computeLuminance()` on both sides for the WCAG contrast-ratio
formula. Do this as a throwaway `flutter test` (needs `dart:ui` via the
Flutter test binding — a plain `dart run` script can't construct
`Color`/`ColorScheme` at all) printing the ratios, then delete the file
once you've read the numbers — it's a one-off measurement, not a
regression test. This is how Phase 4 found that `ModuleKey.tasks`/
`ModuleKey.calendar` (the two the roadmap suspected) actually clear the
_correct_ threshold — 3:1 (WCAG 1.4.11, non-text/icon content), not 4.5:1
(text) — since `moduleColor()` is only ever used as an icon color, never
as text, in this codebase (grep `context.moduleAccent\(` to confirm
before assuming otherwise for a new use). The real failure the roadmap
didn't anticipate was `ModuleKey.notifications`: its amber cleared dark
(8.1:1) but failed light (2.2:1) against the _same brightness-invariant
hex_ — a reminder that "looks fine in dark" and "looks fine in light" are
independent checks for any brightness-invariant color, not implied by
each other. Fixed by deepening the single hex value
(`module_colors.dart`) until it cleared 3:1 on _both_ surfaces — simpler
than splitting it into a `AppColors.light`/`.dark`-style pair like
income/expense already do, and sufficient since one value existed that
worked for both.

### Bugs found migrating Finance (2026-07-27) — neither is a styling issue

Live-testing the migrated Finance tabs end-to-end (create a transaction,
create a budget — not just tapping through screens) surfaced two real,
pre-existing functional bugs that predate this pass and had nothing to do
with the design system. Both are the reason this skill's "run
analyze/test, spot-check on the emulator" checklist item means _exercise
the actual create/edit flow_, not just confirm a screen renders.

1. **The Dart contract generator sent `null` for every unset `.optional()`
   field, which the server rejects.** `TransactionCreateInput.toJson()`
   always included `'note': note`, even when `note` was `null` — but
   `note`'s Zod schema is `.optional()` **without** `.nullable()`, so the
   server's `.parse()` expects the key _missing_ entirely, not
   present-and-null, and 400s with `VALIDATION_ERROR`. This made "create a
   transaction/task/event/etc. without filling in an optional field" fail
   every time, for every module — caught here only because this was the
   first time a create-flow was driven all the way to a real submit against
   real Postgres with an optional field deliberately left blank. Fixed at
   the generator level (`packages/contracts/scripts/generate-dart-models
.mjs`): `unwrap()` now tracks `.optional()` and `.nullable()` as
   separate flags instead of OR-ing them into one, and `buildFields()`
   computes `omitWhenNull = optional && !nullable` per field. A field with
   `omitWhenNull` gets a Dart collection-`if` in `toJson()` (`if (x != null)
'key': x,`) instead of an unconditional entry, so a null Dart value
   omits the key — a field that's genuinely `.nullable()` (with or without
   `.optional()` alongside it, e.g. Tasks' `description`) keeps the
   unconditional form, since that contract expects explicit `null` to mean
   "clear this value." Regenerating (`npm run generate:dart -w
@lifeos/contracts`) touched every module's create/update inputs, not
   just Finance's — this was silently broken everywhere a plain-optional
   field existed. `mobile/test/generated_models_test.dart` has a permanent
   regression test asserting `TransactionCreateInput(note: null).toJson()`
   omits the key.
2. **Two independent places computed "today" as `DateTime.now().year`/
   `.month` directly — Gregorian, not Jalali.** `budgets_tab.dart`'s widget
   (display label + create-dialog target month) and, separately,
   `finance_providers.dart`'s `budgetsProvider` (the actual list query)
   both did this. Today being Gregorian month 7 happens to alias into
   `jalaliMonthNamesFa`'s index 6 ("مهر"), so the _label_ looked plausible
   enough to not immediately read as broken (it said a real Persian month
   name, just the wrong one, paired with the raw Gregorian year — "مهر
   ۲۰۲۶" instead of "مرداد ۱۴۰۵"). The _query_ bug was the one that
   actually broke functionality: `BudgetListQuery`'s `jalaliYear`/
   `jalaliMonth` are **required** (unlike `DashboardQuery`, which makes
   them optional and lets the server default to its own current Jalali
   month) — so `budgetsProvider` must compute a real fallback client-side,
   and sending `jalaliYear=2026&jalaliMonth=7` against a server whose real
   current month was 1405/5 silently returned an empty list every time,
   even with real matching budget rows already in Postgres (confirmed via
   `docker exec ... psql`). Both call sites now go through
   `jalaliForInstant(DateTime.now())` (`format_jalali.dart`) instead of
   reading `.year`/`.month` off the raw `DateTime` — the same Tehran-offset
   conversion every other date display in the app already uses. **Any new
   "what's the current Jalali year/month" computation must go through
   `jalaliForInstant`, never `DateTime.now().year`/`.month` directly** —
   this bug class is easy to reintroduce because the code compiles and
   _looks_ reasonable; only live data exposes it.

## Onboarding tour + per-screen help (2026-07-26, ADR-0016)

Ports web's paired `OnboardingTour`/`PageHelp` system — mobile had zero
onboarding/help code before this (confirmed by grep). See ADR-0016 for
full context; this section is the "how it works" reference.

**Persistence**: `shared_preferences` is mobile's first local key-value
storage dependency (no GMS, safe under ADR-0014). `main.dart` awaits
`SharedPreferences.getInstance()` before `runApp()` and overrides
`sharedPreferencesProvider` (`lib/src/providers.dart`) with the real
instance — reads before that override throws, by design (the standard
Riverpod pattern for an async-init, startup-only dependency). Any future
"remember this across restarts" feature should reuse this provider, not
add a second storage mechanism. `tutorialSeenProvider` (same file) reads/
writes the key `lifeos:onboarding-tour-seen` — the literal string web's
`onboarding-tour.tsx` uses for its own localStorage flag; the two stores
are unrelated, matched purely for grep-ability.

**Help content**: `PageHelpButton` (`lib/src/ui/widgets/page_help_button.dart`)
is mounted **once** in `AppShell`'s `AppBar`, content keyed off the active
bottom-nav destination via `lib/src/nav/module_help_content.dart`'s
`Map<ModuleKey, ({String title, List<String> items})>` — not one call
site per screen file. Content is hardcoded Persian literals, matching
every other string in `mobile/lib/`; **mobile has no i18n system**, and
this feature deliberately doesn't introduce one (see ADR-0016's
Alternatives Considered).

**The tour**: `OnboardingOverlay` (`lib/src/ui/onboarding/onboarding_overlay.dart`)
ports web's CSS `box-shadow: 0 0 0 9999px` spotlight cutout via
`BoxShadow.spreadRadius` — a box with no fill, just a border and a huge
spread shadow, produces the identical "everything except this rect is
dimmed" effect without a `CustomPainter`. Five steps (welcome, bottom
`NavigationBar`, notification bell, help button, overflow menu), mounted
once inside `AppShell.build()` as a `Stack` layer over the `Scaffold`,
gated by `tutorialSeenProvider`, showing itself ~1.5s after mount.

**A real Flutter gotcha this hit, worth knowing for any future overlay**:
`Positioned`/`AnimatedPositioned` only apply their geometry when they are
a **direct** child of a `Stack`. Wrapping the spotlight box in a
`GestureDetector` (for tap-to-dismiss) broke this silently — Flutter
throws `Incorrect use of ParentDataWidget`, but the framework catches and
logs it rather than crashing the screen, so there's no red error screen,
just a spotlight that measures correctly (visible in the log) and then
never actually paints. **This class of bug is invisible to `flutter
analyze`/`flutter test`** — the code type-checks and the widget tree
builds without throwing where the test can see it; it only shows up as a
visually-wrong result on a real device/emulator, or by grepping the
running app's console log for "ParentDataWidget". Fix: give the
tap-to-dismiss handler its own `Positioned.fill` layer _underneath_ the
spotlight box (a direct Stack child in its own right), and wrap the
spotlight box itself in `IgnorePointer` so a tap on it still falls
through to the dismiss layer below — don't wrap positioned content in a
gesture handler, wrap a gesture handler _around_ a separately-positioned
dismiss layer instead.

**Manual replay** (added same day, after initial ship): the tour
originally only ever auto-showed once — there was no in-app way to see it
again after dismissing it. Fixed with a "نمایش راهنما" entry in
`AppShell`'s overflow menu (first item, above "دستگاه‌های فعال") that
bumps `tourRestartSignalProvider` (`lib/src/providers.dart`, a plain
`StateProvider<int>` counter). `OnboardingOverlay` listens for that
counter _changing_ via `ref.listen` (not `ref.watch`) and re-activates
itself without touching the persisted `tutorialSeenProvider` flag — this
required removing `tutorialSeenProvider` from the overlay's `build()`
visibility gate entirely (it's now read only once, in `initState`, to
decide the automatic first-login show); leaving it in `build()` as a
`ref.watch` would permanently suppress any replay the moment the flag
first flipped true. `test/onboarding_test.dart`'s third case drives this
exact path: seed the flag as already-seen, tap the overflow menu, tap
"نمایش راهنما", assert the welcome step reappears.

## Android toolchain on this dev machine (2026-07-25/26)

Same class of block as `registry.npmjs.org` for npm (see CLAUDE.md's
Environment Constraints) — `dl.google.com`, the Android SDK's own update
manifests, and Gradle's default Google/Maven Central repos are all
unreliable-to-blocked from here, and the failure mode is **inconsistent**
(some `sdkmanager` calls for some packages succeed, others on the exact
same host fail with "IO exception while downloading manifest" — don't
assume one success means the block is gone).

**What's mirrored and how:**

- **Flutter/Dart SDK + pub packages**: `FLUTTER_STORAGE_BASE_URL=https://
storage.flutter-io.cn` and `PUB_HOSTED_URL=https://pub.flutter-io.cn`,
  set as persistent Windows user env vars — reliable, used for every
  `flutter pub get`/`flutter build`.
- **Gradle plugin portal + Maven Central + Google's Maven**: proxied by
  `https://mirrors.cloud.tencent.com/nexus/repository/maven-public/`,
  wired into `mobile/android/settings.gradle.kts`'s `pluginManagement.repositories`
  block. Confirmed reachable (AGP + Kotlin resolve through it) — but this only covers
  plugin-portal-style resolution for the root project, **not** a Flutter plugin's own
  bundled `android/build.gradle`. Several plugins (`connectivity_plus` hit this
  2026-07-28, adding it for Phase 3) ship an old-style `android/build.gradle` that
  declares its own `buildscript { repositories { google(); mavenCentral() } }` —
  those calls resolve directly to blocked hosts, bypassing the mirror entirely. Fix:
  `settings.gradle.kts` also needs a `dependencyResolutionManagement` block with
  `repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)` (ignores every
  project/subproject-declared repo in favor of centrally declared ones) listing
  **both** the Tencent mirror **and** `https://storage.flutter-io.cn/download.flutter.io`
  (Flutter's own engine-artifact repo, injected by `FlutterPlugin.kt` as a
  project-level repo on `:app` — omitting it breaks `io.flutter:*_debug`/`*_release`
  resolution the moment `PREFER_SETTINGS` starts ignoring project repos). Add a new
  plugin with its own Android folder → expect to hit this again; check `settings.gradle.kts`
  first before assuming it's a fresh network-block mystery.
- **Android SDK components** (cmdline-tools, platform-tools, emulator,
  system images, NDK, individual `platforms;android-NN`): **not** proxied
  through a config file — `sdkmanager`'s own manifest fetch from
  `dl.google.com` is what's flaky. When `sdkmanager --sdk_root=... "<pkg
id>"` fails with "IO exception while downloading manifest" or "Failed to
  find package", the reliable fallback is downloading the exact package
  zip directly from the Tencent mirror (same file layout as
  `dl.google.com/android/repository/`) and extracting it into place by
  hand:
  ```
  curl -L -o pkg.zip "https://mirrors.cloud.tencent.com/AndroidSDK/<filename>.zip"
  ```
  Find `<filename>` by grepping the mirror's own repository index
  (`https://mirrors.cloud.tencent.com/AndroidSDK/repository2-3.xml`) for
  the package name, e.g. `platform-36_r02.zip` for `platforms;android-36`.
  Extract so the version-named folder's _contents_ land directly in
  `<sdk_root>/platforms/android-NN/` (the zip's top-level folder name
  doesn't always match the target directory name — check before assuming).
  A corrupted/partial download shows up later as a cryptic Gradle
  configuration error (e.g. `[CXX1101] NDK ... did not have a
source.properties file`) — the fix is always delete-and-redownload-via-
  mirror, never "route around the requirement" (removing `ndkVersion`
  from `build.gradle.kts` does **not** work; every Flutter APK bundles the
  engine's native `libflutter.so`, so AGP needs a real NDK regardless of
  whether the app has its own JNI code).
- **JDK**: the system only has JDK 8 (`java -version` → `1.8.0_...`), but
  the current Android cmdline-tools requires 11+ (`UnsupportedClassVersionError:
... class file version 55.0 ... only recognizes up to 52.0`). Microsoft's
  Build of OpenJDK 17 zip download works directly (`https://aka.ms/
download-jdk/microsoft-jdk-17-windows-x64.zip` resolves through
  `download.visualstudio.microsoft.com`, unaffected by the Google-adjacent
  block) — extract anywhere and point `JAVA_HOME` at it for every
  `sdkmanager`/`gradle`/`flutter run` invocation.
- **CMake is a separate SDK component from the NDK** — a plugin with any
  native C/C++ glue (not just Kotlin/Java) can trigger `[CXX1300] CMake
'<version>' was not found` even with a valid NDK installed. Same
  fix: find the exact version Gradle names in the error, grab
  `cmake-<version>-windows.zip` from the mirror's `repository2-3.xml`
  index, and extract it to `<sdk_root>/cmake/<version>/` — but unlike the
  NDK/platform zips, **this zip has no top-level wrapper folder** (`bin/`,
  `share/`, `source.properties` sit at the zip's own root), so extract it
  straight into the version-named target directory, not "extract then
  move up a level" (which silently drops `source.properties` if you glob
  wrong — the exact mistake made once already; verify
  `<target>/source.properties` exists and is non-empty right after
  extracting, before assuming the install worked).
- **Individual plugins can each pin their own `compileSdk`**, independent
  of the app's own `android/app/build.gradle.kts` — `flutter_secure_
storage`'s transitive `jni`/`jni_flutter` packages needed
  `platforms;android-35` even though the app itself targets 36. A Gradle
  failure naming a _different_ API level than what you already installed
  means: install that one too, don't assume it's the same requirement
  restated. Check every plugin's own `android/build.gradle(.kts)` in
  `~/AppData/Local/Pub/Cache/hosted/pub.flutter-io.cn/<pkg>/android/` for
  `compileSdk` before assuming the dependency list is complete.

**Emulator + Docker Desktop can conflict for hardware virtualization** on
Windows (both want exclusive access to virtualization extensions) — if the
emulator process disappears from `adb devices` with no obvious cause after
starting Docker, just relaunch the emulator; don't assume it's a config
problem to debug.

**Cold-start verification recipe**, once the toolchain above is confirmed
working: `docker compose up -d` (Postgres/Redis) → `npm run dev` in
`apps/web` (with `DEV_OTP_CODE=123456` set in `apps/web/.env` for
painless emulator login, per `packages/core/src/auth/crypto.ts`'s
fail-closed dev-only escape hatch) → `flutter run -d emulator-<id>
--dart-define=API_BASE_URL=http://10.0.2.2:3000` (the Android emulator's
alias for the host machine's `localhost`) from `mobile/`.

## Testing

`mobile/test/` uses `flutter_test`, run via `flutter test`. No Postgres
needed — everything here is either a pure Dart unit test (`format_jalali_
test.dart` cross-checks the exact Nowruz-1403 reference instant CLAUDE.md
documents for the server's conversion; `format_money_test.dart`;
`generated_models_test.dart` round-trips real API-shaped JSON fixtures
through the generated models, including the discriminated union) or a
`testWidgets` smoke test (`widget_test.dart`, `onboarding_test.dart` —
the latter overrides `sharedPreferencesProvider` with
`SharedPreferences.setMockInitialValues(...)` plus fake `authController
Provider`/`notificationsProvider` implementations to reach the
authenticated shell without a real network call). Run `flutter analyze` and
`flutter test` after any change — both are fast (single-digit seconds)
and catch real issues (every Riverpod-3-API mismatch above was caught
this way, not by manual testing).

## Known gaps / deliberate deferrals (mirrors CLAUDE.md's own section)

- **Push notifications**: not implemented. Many Iranian Android devices
  lack Google Play Services, so FCM is unreliable/absent — the
  Notifications screen instead polls `GET /api/v1/notifications` every
  30s via a `Timer.periodic` inside its `AsyncNotifier` (torn down by
  `autoDispose` the moment nothing is watching it). Real push is a later
  integration via an Iran-native provider (Cafe Bazaar Pushe / Myket
  push) — see `docs/decisions/` for the ADR. Do not add
  `google_mobile_ads`/Firebase/any GMS-dependent package without
  revisiting this — it would break the APK on non-GMS devices.
- **iOS**: not targeted. `mobile/ios/` exists only because `flutter
create` scaffolds it; no iOS-specific work has been done.
- **Release signing, Cafe Bazaar/Myket store listings, direct-download
  beta APK**: not started — blocked on Stage C (a real internet-facing
  VPS; see the `deployment` skill), since a physical device can't reach
  `localhost` and emulator-only testing isn't a real release gate.
- **No offline sync** — online-first only, consistent with ADR-0002;
  every user-data table already carries the sync-ready fields
  (`id`/`createdAt`/`updatedAt`/`deletedAt`/`version`) a future delta-sync
  layer would need, but building that layer is out of scope here.
