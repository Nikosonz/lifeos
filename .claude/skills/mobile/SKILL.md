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
```

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
  variant (e.g. `CalendarEventItemResponse`) is usually *also* a separate
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
`lib/src/router.dart` (go_router) are the Dart analog of the web's
`AppShell`/`Nav` — one `NavigationDrawer` for all six modules (a 6-item
bottom nav bar exceeds Material's recommended max of 5), tabs *within* a
module screen for its sub-pages (Finance: Dashboard/Wallets/Categories/
Transactions/Budgets; Tasks: Tasks/Projects/Labels) rather than deeper
drawer nesting or a URL-per-subpage structure like the web.

**Auth**: `lib/src/auth/token_store.dart`'s `TokenStore` interface branches
on `Platform.isAndroid` (`providers.dart`) — `SecureTokenStore`
(`flutter_secure_storage`, Android Keystore-backed) on Android,
`InMemoryTokenStore` everywhere else (Windows dev builds, the test
harness). `lib/src/api/api_client.dart`'s `AuthInterceptor` is a
line-by-line Dio port of the web's `apiFetch` 401-refresh-rotation logic
(de-duped concurrent refresh, one retry, clear+logout on failure).

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
  already wired into `mobile/android/settings.gradle.kts` and
  `android/build.gradle.kts`'s `repositories {}` blocks. Confirmed
  reachable (AGP + Kotlin resolve through it).
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
  Extract so the version-named folder's *contents* land directly in
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
  failure naming a *different* API level than what you already installed
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
`testWidgets` smoke test (`widget_test.dart`). Run `flutter analyze` and
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
