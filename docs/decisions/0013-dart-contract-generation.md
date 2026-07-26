# ADR-0013: Generate Dart models from Zod contracts with a custom script, not openapi-generator

## Status

Accepted

## Date

2026-07-25

## Context

Choosing Flutter (ADR-0012) means the mobile client cannot import `packages/contracts`'s Zod schemas the way the web app does — Dart and TypeScript don't share a runtime. Hand-writing Dart DTOs for all six modules would create the exact class of bug the web client's runtime `apiFetch(...).parse()` validation exists to catch (a contract changes, the hand-maintained copy silently drifts — see CLAUDE.md's `SignedMoneyAmount` incident for a real instance of this happening even _within_ the same TypeScript codebase). `packages/contracts` is the only source of truth this system has; the mobile client needs a way to stay in lockstep with it mechanically, not by discipline.

The original mobile roadmap (`~/.claude/plans/7-18-2026-11-25-pm-pouya-async-toast.md`) proposed generating an OpenAPI 3/JSON-Schema document from the Zod contracts (via Zod v4's native `z.toJSONSchema()`) and then running `openapi-generator-cli`'s `dart-dio` generator against it.

## Decision

Generate Dart models with a **custom Node script**
(`packages/contracts/scripts/generate-dart-models.mjs`) that imports the
Zod schema modules directly, walks each exported schema's runtime shape via
Zod v4's own introspection (`schema.def.type`, not the JSON-Schema
conversion), and emits hand-crafted-equivalent Dart classes/enums/sealed
unions into `mobile/lib/src/generated/`. Run via `npm run generate:dart -w
@lifeos/contracts`; regenerate after any contract change.

## Alternatives Considered

### `openapi-generator-cli` (the originally planned approach)

- Pros: A standard, widely-used tool; would also produce a genuine OpenAPI document as a side effect, which CLAUDE.md has "long-promised" for a future public API/MCP surface.
- Cons: Requires a JDK 11+ (this dev machine only had JDK 8 installed, and the newer JDK had to be fetched separately anyway — see the `deployment`/`mobile` skills' notes on this machine's Java situation) _and_ downloads the generator JAR itself from Maven Central/GitHub at first use — a second and third fragile dependency on a network already documented as unreliable for Google-adjacent hosts (CLAUDE.md's Environment Constraints, extended to Android/Gradle in this session). Generic generators also produce generic output: no clean way to express "this Zod string is money, keep it a String" or "this union needs shared-field getters on the sealed base" without fighting mustache templates.
- Rejected for now: too many stacked points of failure for what this session could reliably verify end-to-end on this machine, and the generic output would need post-processing to match this codebase's actual conventions (money-as-String, sealed unions with shared getters) anyway. Revisit if/when a real OpenAPI document is needed for a different consumer (public API docs, MCP) — the custom script's `z.toJSONSchema()` groundwork could still feed that path later without changing the Dart output.

### Hand-written Dart DTOs (no generation at all)

- Pros: Zero tooling, immediately understandable, no generator to debug.
- Rejected: This is exactly the drift risk described in Context — six modules' worth of response/request shapes, manually kept in sync with Zod schemas that already changed shape at least once mid-project (the `SignedMoneyAmount`/`MoneyAmountInput` split). The auth module's original hand-written `auth_models.dart` was explicitly marked "deliberately temporary" in its own doc comment for this reason and was the first thing replaced once the generator existed.

## Consequences

- **The generator is the single source of truth for wire-shape correctness** on the Dart side — `mobile/test/generated_models_test.dart` round-trips real API-shaped JSON fixtures (including the Calendar discriminated union) through the generated models specifically to prove the pipeline, not just individual endpoints, works.
- A contract change that isn't followed by regeneration doesn't fail loudly today (no CI wiring yet enforces "generated output matches contracts" — see the `mobile` skill's Known Gaps). Add a CI check that runs the generator and diffs the output before this client has real users.
- The generator only handles the Zod construct shapes actually used in this codebase (object/enum/discriminated-union at the top level; string/number/boolean/array/nullable/optional/default at the field level) — it throws loudly on anything unrecognized rather than silently mis-generating, so a genuinely new Zod pattern in a future contract will surface as a build failure, not a subtle runtime bug.
- No OpenAPI document exists yet as a byproduct. If a future public API or MCP integration needs one, extending the generator to also emit `z.toJSONSchema()` output alongside the Dart files is straightforward (the per-schema introspection is already there) — this ADR does not foreclose that, it just doesn't build it prematurely.
