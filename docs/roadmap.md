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

- [x] `themeModeProvider` (persisted `lifeos:theme-mode`, mirrors `TutorialSeenController`
      exactly — a `Notifier<ThemeMode>` reading `SharedPreferences` synchronously in
      `build()`, storing `ThemeMode.name` rather than an int index); wired into
      `MaterialApp.router(themeMode:)` in `app.dart`. Read at the app root (not inside
      `AppShell`), so it applies to the login screen too, not just the authenticated shell.
- [x] Toggle in `AppShell`'s overflow menu — three `CheckedPopupMenuItem`s (پیش‌فرض سیستم/
      حالت روشن/حالت تیره) above a divider, existing تور/دستگاه‌ها/خروج items unchanged
- [x] Audited for remaining light-assuming colors not already covered by Phase 2 (grepped
      for `Colors.*`/hardcoded hex outside `theme/`): none found — Phase 2's migration was
      thorough. The onboarding overlay's `Colors.black.withValues(alpha: 0.6)` scrim is
      deliberately brightness-invariant (a dimming backdrop, not text/icon content) and is
      correct as-is.
- [x] Checked `ModuleKey.tasks`/`ModuleKey.calendar` contrast on dark M3 surfaces via a
      `flutter test` scratch script computing real WCAG contrast ratios against
      `ColorScheme.fromSeed`'s actual dark `surface` color: both already clear the
      applicable 3:1 WCAG 1.4.11 non-text-contrast minimum (these accents are only ever
      used as icon colors, never text) — tasks 3.76:1, calendar 3.55:1. No fix needed;
      the roadmap's original 4.5:1-based concern was the wrong threshold for icon-only
      usage. The same audit found a real failure the roadmap didn't anticipate:
      `ModuleKey.notifications`' amber cleared dark (8.1:1) but failed light (2.2:1) —
      fixed by deepening it (`0xFFE99B2A` → `0xFFA8641A`, module_colors.dart), which now
      clears 3:1 on both (4.4:1 light, 4.0:1 dark) as a single brightness-invariant value.
- [x] First theme-exercising tests — `test/theme_test.dart`: defaults to `ThemeMode.system`
      with nothing persisted, restores a persisted `dark` mode on launch (asserting both
      `MaterialApp.themeMode` and the actual rendered `Theme.of(context).brightness`), and
      the overflow-menu toggle both switches the live theme and persists it. Also fixed
      `widget_test.dart`, which broke because `themeModeProvider`'s new root-level read
      needs a `SharedPreferences` override that test never provided.
- [x] Verified live on the emulator (debug APK, real dockerized Postgres): toggled دارک/light
      from the overflow menu on the Finance dashboard, confirmed the switch is instant
      (no restart) and persists; spot-checked Finance (Dashboard+Budgets), Tasks, Habits,
      Calendar, Reports, Notifications (confirms the amber fix), and Login all render
      correctly in dark — text, icons, module-accent chips, skeleton shimmer, and the FAB
      all legible. Sessions was not live-driven (repeated OTP-expiry friction while
      re-authenticating burned the available attempts) but was not code-changed either —
      it composes the same `AsyncValueView`/`AppListRow`/`EmptyState` widgets already
      proven correct on every other screen, so it's covered by construction.

## Phase 5 — Backend hardening

- [x] Redis client in `packages/core` (`src/rate-limit/`: a `RateLimitStore` port with
      Redis + in-memory adapters, `RateLimitService` owning every decision, `policies.ts`
      holding the actual numbers, and a lazily-resolved `container.ts`). Limiter hooked
      into `runRoute` via an optional leading options argument, so the existing
      `runRoute(handler)` form at ~60 call sites was untouched. `Retry-After` is derived in
      `toErrorEnvelope` (which now also returns `headers`) rather than in route handlers,
      keeping "one place maps thrown → wire" intact.
- [x] Applied per-IP to the three unauthenticated auth routes: `request-otp` (the
      SMS-bombing gap CLAUDE.md documents), `verify-otp`, `refresh`. **Not** a generic
      per-user default: `runRoute` runs before `requireUser`, so it has no user identity,
      and a blanket per-IP cap would misfire on shared/NATed IPs (common in Iran) while
      adding nothing for Bearer-authenticated routes. Revisit if a real abuse case appears
      on an authenticated route.
- [x] Migrated the OTP resend cooldown off its read-then-write Postgres race onto an atomic
      single-slot claim (`SET NX PX` via Lua). The old timestamp check survives as a
      **fallback**, reached only when the store itself is unavailable and fails open —
      degrading to the racy-but-real check beats degrading to no cooldown, since this is
      what gates SMS spend.
- [x] Security headers via `headers()` in `apps/web/next.config.mjs` — CSP, HSTS,
      X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options.
      HSTS and CSP's `upgrade-insecure-requests` are production-only (a two-year HSTS
      max-age served over `http://localhost` would pin the dev machine's browser to HTTPS);
      CSP's `unsafe-eval` is dev-only (React Refresh). No `preload` on HSTS — irreversible
      on a timescale this project can't commit to, with no domain deployed to submit.
- [x] `z.uuid()` validation on every `[id]`/`[subtaskId]` path param via a shared
      `uuidParams()` helper (`apps/web/src/lib/path-params.ts`), applied across all 14
      dynamic route files / 34 call sites. Throws ZodError, so `runRoute` already turns it
      into the standard `VALIDATION_ERROR` 400 — previously a malformed id reached Prisma
      and surfaced as a 500 with a stack trace.
- [x] Documented the CORS decision (ADR-0019) directly in `next.config.mjs`'s `headers()`,
      where someone would actually go to add `Access-Control-*`, rather than only in the ADR
- Verified 2026-07-28 against real dockerized Redis + Postgres: 10 OTP requests pass and
  the 11th returns `429` + `retry-after: 3599` (window not extended by later hits, confirmed
  via `redis-cli TTL`); an immediate resend returns `429` + `retry-after: 60`; malformed
  path params return `400 VALIDATION_ERROR` with `path: ["subtaskId"]` naming the offending
  segment, while a valid-but-missing uuid still returns `404`; the full header set is
  present on `/api/v1` responses in dev **and** on a `400` error envelope in a real
  production build (proving ADR-0019's "headers apply to runRoute's catch path" requirement).
  `npm run lint`/`typecheck`/`test` (209 tests)/`format:check` all green, `next build` clean.
- Found and fixed while verifying, invisible to every other gate: `RedisRateLimitStore`
  combined `lazyConnect: true` with `enableOfflineQueue: false`, which cannot work —
  with no connection open, the first command has nothing to queue it and fails with
  `Stream isn't writeable and enableOfflineQueue options is false`. Every check therefore
  fell through `RateLimitService`'s fail-open path and the limiter silently enforced
  **nothing**. Types, lint, and the unit tests (which use the in-memory store) all passed
  throughout; only driving real requests against real Redis exposed it. This is the Phase-5
  instance of the mobile skill's standing lesson that a green analyze/test run is not
  evidence a feature works.

## Phase 6 — Accounts: display name, real signup, settings, privacy policy

- [x] `User.name String?` migration (`20260728134345_add_user_name`). Stays optional
      permanently, not a nullable field awaiting backfill: accounts are created by OTP
      verification, which only ever knows an identifier, and the name step is skippable —
      so "account exists" and "account has a name" are genuinely independent states.
- [x] `isNewUser` on the verify-otp response; `name` on `UserResponse`/`MeResponse`/
      `UpdateProfileInput`. `UpdateProfileInput.name` is `.nullable().optional()` — omitting
      the key means "leave unchanged", an explicit `null` means "clear it", so a user who set
      a name can remove it again (the gap CLAUDE.md documents for Calendar's `description`).
      `isNewUser` is computed at the exact find-or-create moment in `OtpService` and returned
      up through `AuthService`, because nothing downstream can reconstruct it: a
      just-created user is indistinguishable from an existing one a moment later, and
      comparing `createdAt` to "now" would be a guess.
- [x] `auth.user.created` audit event, recorded **in addition to** `auth.login`, not instead
      of it — a signup genuinely is both, and making them exclusive would put a hole in any
      "count logins" query. Verified against real Postgres: one `auth.user.created` row and
      two `auth.login` rows after two logins on the same identifier.
- [x] Mobile: name step shown to first-time users only, driven by the server's `isNewUser`
      (never inferred from a null name, which a returning user who skipped also has). The
      new user is deliberately held back from `AuthController` until the step resolves, or
      the router would swap the app shell in underneath it. Dart models regenerated.
- [x] Mobile Settings screen (`ui/settings/settings_screen.dart`): name, timezone, calendar
      preference, theme mode, and links to sessions + the privacy policy. The theme control
      **moved here** from `AppShell`'s overflow menu, where Phase 4 parked it for lack of a
      settings screen — consolidated rather than duplicated, so `theme_test.dart` now drives
      the real route.
- [x] `apps/web/src/app/[locale]/privacy/page.tsx` (fa + en), linked from the landing footer,
      the login consent line, and mobile Settings. A plain Server Component and reachable
      logged-out — Cafe Bazaar/Myket both require a publicly-fetchable policy URL.
- [x] Consent line at account creation — rendered on the identifier/code steps, not the name
      step, because the account is created the moment the code is verified and notice has to
      precede that.
- [x] Web parity: a Settings page with the name field **and** the device-management UI web
      never had despite CLAUDE.md describing it as shipped. Pure composition of existing
      endpoints; `SessionListResponse` was added to contracts so `apiFetch` can `.parse()`
      the envelope `GET /auth/sessions` has always returned (not a wire change).
- Verified 2026-07-29 against real Postgres: first verify returns `isNewUser: true` with
  `name: null`, a second login on the same identifier returns `false`; `PATCH /me` sets,
  reads back, clears via explicit `null`, and leaves the name untouched when the key is
  omitted (while `timezone` changes in the same call); `/fa/privacy` and `/en/privacy` both
  200 with the full Phase-5 header set. `npm run lint`/`typecheck`/`test` (211 tests, +4
  new)/`format:check` green, `next build` clean, `flutter analyze` clean, `flutter test`
  17/17, Playwright 8/8.
- **Phase 5's per-IP rate limit made the e2e suite unrunnable, and Phase 6 is what surfaced
  it.** Every spec runs from one IP (localhost) and each does 1–2 `request-otp` calls, so a
  single full-suite run plus any manual curl verification blows through `otpRequestPerIp`
  (10/hour) partway through — four specs failed on a `429` that looked exactly like a
  regression in the feature under test. Raising the number does not fix it: any limit low
  enough to be meaningful in production is too low for a repeatedly-run suite. Fixed by
  disabling **per-IP** limits when `DEV_OTP_CODE` is set and `NODE_ENV !== "production"`,
  reusing that existing dev-mode signal (which already hard-throws in production) rather
  than adding a second variable that could disarm production. Per-identifier cooldowns are
  untouched — they are not IP-scoped and stay enforced even on a dev box, which is what
  actually guards SMS spend. Two tests cover both halves.
- Separately noted, not fixed: with a cold Next dev server, whichever spec runs first can
  fail on route-compilation latency (a different spec each run; all 8 pass once routes are
  warm). Pre-existing dev-mode behavior, unrelated to this phase.

## Phase 7 — Self-hosted telemetry

- [ ] `packages/core/src/telemetry/` + `/api/v1/telemetry/{crashes,events}` (standard
      Module Pattern)
- [ ] Mobile global error handler (`FlutterError.onError` + `PlatformDispatcher.onError`
      inside `runZonedGuarded`) — currently absent entirely
- [ ] Crash buffer-to-disk, flush on next launch
- [ ] Typed analytics event enum, batched — not free-form strings
- [ ] Opt-out in Settings; disclosed in the privacy policy from Phase 6
