# ADR-0018: Add a user display name and a real isNewUser signal to OTP verify

## Status

Accepted

## Date

2026-07-27

## Context

`POST /api/v1/auth/verify-otp` currently find-or-creates a `User` row silently inside
`otp-service.ts`'s `verifyOtp`:

```ts
if (channel === "SMS") {
  const existing = await this.userRepository.findByPhone(identifier);
  return existing ?? this.userRepository.createWithPhone(identifier);
}
```

That `??` is the entire signup feature today. `AuthService.verifyOtpAndLogin` receives
whichever `User` came back, creates a session, and audit-logs `action: "auth.login"` —
**a brand-new account is logged as a login, not a registration**, and the response
(`{ user, tokens }`) carries no flag distinguishing the two. No client, mobile or web, can
currently tell whether the account it just authenticated into existed a moment ago.

Consequences of that gap, found while auditing the login UX for this roadmap:

- Both clients show byte-identical UI to a first-time and a returning user — the mobile
  screen's own doc comment even frames the whole flow as "OTP login," never mentioning
  account creation.
- There is no point in either app where a first-time user is told an account is being made
  for them, which is also where a privacy-policy consent line would naturally belong
  (see the Phase 6 roadmap item and CLAUDE.md's Secret Hygiene / legal-copy gap — there is
  currently no legal text anywhere in the app).
- `packages/db/prisma/schema.prisma`'s `User` model has no display name — `id`, `phone`,
  `email`, `timezone`, `calendarPreference`, plus sync/audit columns. There's nowhere to
  show a user's own name anywhere in either client.

## Decision

- Add `name String?` to `User` (nullable — same "optional identifier, not enforced at the
  DB layer" precedent already used for `phone`/`email`).
- Add `isNewUser: boolean` to `VerifyOtpInput`'s response contract, computed from the same
  find-or-create branch that already exists in `otp-service.ts` — return whether the
  `??` right-hand side actually ran, not a second existence check.
- Add a distinct `auth.user.created` audit-log event alongside the existing `auth.login`,
  following the existing stable-`event`-name convention (`auth.otp.requested`,
  `auth.login`, `auth.logout`, `auth.session.revoked`).
- Add `name` to `UserResponse`/`MeResponse`/`UpdateProfileInput`, writable via the existing
  `PATCH /api/v1/me` (which already accepts `timezone`/`calendarPreference` today with no
  UI on any client — see Phase 6).
- Mobile UX: `isNewUser: true` routes to a one-field name-entry step before landing on
  `/finance`; `isNewUser: false` skips straight there, matching today's behavior exactly.

## Alternatives Considered

### Cosmetic copy only — leave the backend untouched

- Pros: Zero backend risk, zero migration, ships in an afternoon.
- Cons: Solves the wording problem ("ورود" reads like a login-only action) but not the
  underlying one — the app still can't distinguish a new account from a returning one, so
  it can't show a first-run welcome, can't gate a consent checkbox to the actual moment of
  creation, and can't ever show the user their own name anywhere.
- Rejected: the roadmap's account/settings/privacy-policy work (Phase 6) all depend on
  knowing when an account is created and having somewhere to store what to call the user —
  deferring this just moves the same migration into that phase anyway, with less clarity
  about why.

### Full identity-linking (merge phone + email into one account)

- Pros: Solves the separately-documented "logging in by phone once and by email another
  time creates two separate accounts" gap CLAUDE.md already calls out as a deliberate scope
  cut.
- Cons: A materially larger feature — needs an explicit linking flow (prove ownership of a
  second identifier while already authenticated), decisions about what happens to
  historical data under each identity, and touches every module's `userId` foreign keys'
  assumptions nowhere else in the codebase. Not something to bundle into a display-name change.
- Rejected for this ADR: still the deliberate scope cut CLAUDE.md documents. This ADR does
  **not** change that — `phone` and `email` remain independent, optional-but-unique
  identifiers with no linking flow. Worth its own ADR if it's ever tackled.

## Consequences

- One additive, nullable-column migration (`User.name`) — no backfill needed, no existing
  row becomes invalid.
- `verifyOtp`'s find-or-create logic itself doesn't change, only what it reports back —
  low risk of behavior regression in the auth flow the `verify` skill exercises end-to-end.
- Both clients need a small new screen/step (name entry) and Dart-model regeneration
  (`npm run generate:dart -w @lifeos/contracts`) once the contract changes.
- This is the first place either client will show consent/legal copy — the privacy policy
  page (Phase 6) should exist before or alongside this shipping, not after.
