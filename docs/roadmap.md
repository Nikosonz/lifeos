# مال تو — roadmap (mobile polish, security, accounts, telemetry)

Checked-in tracker for the phased build that followed PR #14 (design system + onboarding
tour + Finance-tab migration). Each phase is one PR against `main`, verified on the emulator
(and against real Postgres for backend changes) before the next starts. Tick items as they
land; don't let this drift out of sync with reality — if a phase's scope changes mid-build,
edit this file in the same PR.

See `docs/decisions/0017-self-hosted-telemetry.md`, `0018-user-display-name-and-signup.md`,
and `0019-api-security-posture.md` for the reasoning behind the choices below, not just the
checklist.

## Already done — do not re-plan or rebuild

Found true by direct code audit while scoping this roadmap (2026-07-27). Re-verify with a
grep before assuming any of these is still accurate, per this repo's own memory-hygiene rule.

- Refresh-token rotation: complete server-side (opaque, hashed, rotates on every use,
  reuse-of-rotated-token rejected) and client-side (`AuthInterceptor` in
  `mobile/lib/src/api/api_client.dart`, de-dupes concurrent 401s to one refresh call, single
  retry, clean logout on failure).
- Request validation: 26/26 route bodies and 10/10 query-string reads under
  `apps/web/src/app/api/v1/**` are Zod-parsed via `packages/contracts`. Gap: `[id]` path
  params are not validated — see Phase 5.
- Encrypted local storage: access/refresh tokens live in Android Keystore via
  `flutter_secure_storage` (`mobile/lib/src/auth/token_store.dart`). Plain
  `SharedPreferences` holds exactly one non-sensitive key
  (`lifeos:onboarding-tour-seen`).
- No secret/API key is embedded in the APK — grep-verified across `mobile/lib` and
  `mobile/android`. The app is credential-free by design; all auth is runtime OTP.
- `AppScaffold`/`AsyncValueView`/`EmptyState`/`ErrorState`/`AppListRow`/`MoneyText`/
  `MonthStepper`/`SectionHeader`/`PageHelpButton` all exist in
  `mobile/lib/src/ui/widgets/` and are proven on 6 screens (Finance's 5 tabs + Habits).
- Dark mode already renders correctly for what's been migrated — `darkTheme:` is passed in
  `mobile/lib/src/app.dart` and `AppColors.dark` is genuinely hand-tuned, not a copy of
  light. Missing piece is user control (Phase 4), not the theme itself.

## Phase 0 — Roadmap + ADRs

- [x] `docs/roadmap.md` (this file)
- [x] `docs/decisions/0017-self-hosted-telemetry.md`
- [x] `docs/decisions/0018-user-display-name-and-signup.md`
- [x] `docs/decisions/0019-api-security-posture.md`
- [x] Point CLAUDE.md's Known Limitations at this file

## Phase 1 — Release blockers

- [x] Add `INTERNET` permission to the main `AndroidManifest.xml` (currently only in
      `src/debug/` and `src/profile/` — a release build has no network permission at all)
- [x] Real `signingConfigs.create("release")` in `build.gradle.kts`, reading
      `key.properties` with a debug-signing fallback for local builds
- [x] Enable `isMinifyEnabled`/`isShrinkResources` + `proguard-rules.pro`
- [x] Add `*.jks`, `*.keystore`, `key.properties` to the **root** `.gitignore` (protection
      today lives only in `mobile/android/.gitignore`)
- [x] Verify: `flutter build apk --release`, install, confirm it reaches the API

## Phase 2 — Finish the design-system migration

- [x] `ui/tasks/tasks_tab.dart`
- [x] `ui/tasks/projects_tab.dart` — `onLongPress` delete → visible `RowAction`
- [x] `ui/tasks/labels_tab.dart` — add missing delete confirmation
- [x] `ui/tasks/task_detail_sheet.dart` — add missing subtask-delete confirmation
- [x] `mobile/lib/src/tasks/task_labels.dart` — retire the six Material color constants;
      note cross-module blast radius into `ui/calendar/calendar_home.dart`
- [x] `ui/calendar/calendar_home.dart` — `MonthStepper`, token colors
- [x] `ui/reports/reports_home.dart` — reintroduce `StatCard.dense`, `MoneyText`
- [x] `ui/sessions/sessions_screen.dart` — keep bare `Scaffold` (owns its own AppBar),
      adopt `AsyncValueView`/`EmptyState`/`AppListRow`; revoke gets a confirm dialog;
      `lastUsedAt` through `formatJalaliDate`
- [x] `ui/login_screen.dart` — tokens, map `ApiException.code` to Persian copy via
      `ErrorState`'s existing mapping instead of showing raw English server messages
- [x] Shared `confirmDestructive(context, title)` helper, replacing 5 duplicated dialogs;
      wire `colorScheme.error` on the confirm button
- [ ] Deferred, not in this phase: collapsing the nested-Scaffold-per-tab structure
- Verified 2026-07-27: `flutter analyze` clean, `flutter test` 14/14, zero surviving
  `'خطا: $e'` patterns (grep), live emulator spot-check of all 8 migrated screens (Tasks +
  Projects + Labels + task detail sheet's confirm-delete, Calendar, Reports' dense
  `StatCard` pair, Sessions, Login's mapped Persian OTP-error copy).

## Phase 3 — UX states: skeletons + offline

- [x] `ui/widgets/skeleton.dart` (shimmer, zero new dependency); optional `skeleton` builder
      on `AsyncValueView`, wired into 9 list-shaped screens (Wallets/Categories/
      Transactions, Tasks/Projects, Habits, Calendar agenda, Notifications, Sessions)
- [x] `connectivity_plus` dependency + `isOfflineProvider`; persistent offline banner in
      `AppShell`. `AsyncValueView`/`ErrorState` already preferred the offline message on a
      _failed_ request via `ApiException.status == 0` (pre-existing since Phase 2's error
      mapping) — this phase adds the _proactive_ signal for "known offline, nothing
      attempted yet"
- [x] Pull-to-refresh is already uniform as of Phase 2's `AppScaffold(onRefresh:)` adoption
      (Tasks/Calendar/Reports use it directly); Sessions and Notifications keep their own
      `RefreshIndicator` because they own a bare `Scaffold` (pushed routes with their own
      AppBar, not wrapped in `AppScaffold`) — already documented in-file, not new scope
- Verified 2026-07-28: `flutter analyze` clean, `flutter test` 14/14, live emulator
  spot-check — offline banner appears/disappears on `svc wifi/data disable`+`enable`,
  skeleton shimmer renders on fresh provider mount (tab switch), pull-to-refresh unaffected
- Fixed incidentally while verifying on-device: `mobile/android/settings.gradle.kts` needed
  a `dependencyResolutionManagement` block (`PREFER_SETTINGS` + the Tencent mirror + the
  Flutter engine-artifact repo) — `connectivity_plus`'s bundled `android/build.gradle`
  declares its own `google()`/`mavenCentral()` repos, which resolve directly to blocked
  hosts in this environment, bypassing `pluginManagement`'s existing mirror entirely (that
  block only covers plugin-portal-style resolution, not a subproject's own buildscript
  classpath deps)

## Phase 4 — Dark mode

- [ ] `themeModeProvider` (persisted `lifeos:theme-mode`, mirrors `TutorialSeenController`)
- [ ] Toggle in `AppShell`'s overflow menu (system/light/dark)
- [ ] Fix remaining light-assuming colors not already covered by Phase 2
- [ ] Check `ModuleKey.tasks`/`ModuleKey.calendar` contrast on dark M3 surfaces
- [ ] First theme-exercising test
- [ ] Verify every screen in both modes on the emulator

## Phase 5 — Backend hardening

- [ ] Redis client in `packages/core`; rate limiter hooked into `runRoute`
      (`apps/web/src/lib/route-handler.ts`) — per-IP on `request-otp` first, then a generic
      per-user default; `Retry-After` header
- [ ] Migrate the OTP resend cooldown off its read-then-write Postgres race
- [ ] Security headers via `headers()` in `apps/web/next.config.mjs` (CSP, HSTS,
      X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options)
- [ ] `z.uuid()` validation on every `[id]` path param
- [ ] Document the CORS decision (ADR-0019) in code where relevant

## Phase 6 — Accounts: display name, real signup, settings, privacy policy

- [ ] `User.name String?` migration
- [ ] `isNewUser` on verify-otp response; `name` on `UserResponse`/`MeResponse`/
      `UpdateProfileInput`
- [ ] `auth.user.created` audit event, distinct from `auth.login`
- [ ] Mobile: name step for first-time users only; regenerate Dart models
- [ ] Mobile Settings screen: name, timezone, calendar preference, theme, links to
      sessions + privacy policy
- [ ] `apps/web/src/app/[locale]/privacy/page.tsx` (fa + en), linked from the landing
      footer and mobile Settings
- [ ] Consent line at account creation
- [ ] Web parity: name field, sessions/device-management UI (mobile has it, web doesn't)

## Phase 7 — Self-hosted telemetry

- [ ] `packages/core/src/telemetry/` + `/api/v1/telemetry/{crashes,events}` (standard
      Module Pattern)
- [ ] Mobile global error handler (`FlutterError.onError` + `PlatformDispatcher.onError`
      inside `runZonedGuarded`) — currently absent entirely
- [ ] Crash buffer-to-disk, flush on next launch
- [ ] Typed analytics event enum, batched — not free-form strings
- [ ] Opt-out in Settings; disclosed in the privacy policy from Phase 6
