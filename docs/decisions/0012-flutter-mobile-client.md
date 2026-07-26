# ADR-0012: Flutter as the mobile client framework

## Status

Accepted

## Date

2026-07-25

## Context

CLAUDE.md's founding thesis is "the website is only Client #1 — Android, iOS, desktop, Telegram, AI agents, MCP clients, and a public API must all consume the same backend without backend changes." The web app (Finance/Tasks/Habits/Calendar/Notifications/Reports) is done; Android is the first real test of that thesis. A framework choice made here also sets the template for iOS/desktop later, since the goal is one Dart codebase across all three.

## Decision

Build the mobile client in **Flutter (Dart)**, at a top-level `mobile/` directory (sibling to `apps/`/`packages/`, outside the npm workspace globs). Distribution targets **Cafe Bazaar and Myket**, not Google Play — Google Play is largely unavailable to Iranian developers and users, and this shapes dependency choices throughout (see ADR-0014's exclusion of GMS-dependent packages).

## Alternatives Considered

### React Native

- Pros: Shares TypeScript/JS with the web app; some component logic could theoretically be shared (though Rule 1 already forbids sharing _business_ logic with a client, so the actual overlap is thin — presentation-only).
- Cons: The bridge architecture (or the newer JSI/Fabric path) has historically been less consistent for complex native UI and offline-capable storage than Flutter's own rendering engine; native module ecosystem for Iran-specific concerns (Cafe Bazaar/Myket in-app billing, Pushe push) is less mature than for Flutter.
- Rejected: No decisive advantage over Flutter for this project's needs, and Dart's cross-platform reach (Android now, iOS/desktop later from one codebase) was rated higher than TS-language continuity with zero business-logic sharing anyway.

### Native Kotlin (Android only)

- Pros: Best possible native performance and platform-API access; no cross-platform abstraction layer to fight.
- Cons: Zero code reuse toward a future iOS client — would mean rewriting the entire UI layer from scratch a second time. Given iOS is explicitly a stated future target (CLAUDE.md's client list), this cost is real, not hypothetical.
- Rejected: The platform list this project has committed to (Android, iOS, desktop) makes single-codebase cross-platform reach worth more than native-only performance headroom that a life-management CRUD app doesn't actually need.

### Capacitor / other WebView-wrapper frameworks

- Pros: Maximum reuse of the existing Next.js web app's UI code, near-zero new UI work.
- Cons: A WebView-wrapped web app is not what "Android is the first proof the thesis holds" is meant to prove — it would validate that a browser can run on a phone, not that a genuinely separate client can consume the same `/api/v1` surface independently. Also weaker offline/native-feel characteristics than a real native/Flutter build, and Iran-specific push (Pushe/Myket) integrates less cleanly into a WebView shell.
- Rejected: Doesn't test the actual architectural claim this project cares about, and produces a worse end-user experience than a native-feeling Flutter app.

## Consequences

- **Dart cannot import `packages/contracts`'s Zod schemas directly** — the single biggest architectural consequence of this choice. Resolved by ADR-0013's contract-generation pipeline rather than hand-written Dart DTOs.
- A `mobile` skill needed to be written from scratch (`.claude/skills/mobile/SKILL.md`) since no Flutter/Dart/Android skill existed anywhere in this project or globally — the same pattern the `telegram`/`mcp` skills already established for other not-yet-built clients.
- Distribution via Cafe Bazaar/Myket (not Google Play) means GMS-dependent packages (Firebase Cloud Messaging, Google Mobile Ads, etc.) must be avoided — see ADR-0014.
- Every new `/api/v1` capability must be verified against a real Flutter screen eventually, the same "can Android use this?" discipline CLAUDE.md's Architecture Rule 4 already states — this ADR is what makes that question concrete rather than hypothetical.
