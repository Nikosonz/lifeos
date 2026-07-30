# ADR-0020: `version` becomes real optimistic concurrency — optional `expectedVersion`, enforced in the write, surfaced as 409

## Status

Accepted

## Date

2026-07-30

## Context

Every user-data model carries a `version Int @default(1)` column, incremented on every write by every repository, and documented in CLAUDE.md's "Sync-Ready Convention" as part of what lets mobile/offline clients add delta sync later "with zero backend changes."

An architecture review found that **no query anywhere reads it**. A grep across all 18 repositories returns zero `where` clauses referencing `version`; it appears only as `version: { increment: 1 }`. The column is written and never compared.

Three things follow from that, and the third is why this ADR exists:

1. **Concurrent edits silently lose data today.** Two devices editing the same task both `PATCH` it; the second write wins and the first is gone with no error, no audit signal, and nothing for a client to detect. This is not hypothetical — the Flutter client shipped in 2026-07-25/26 (ADR-0012), so "edit on phone, edit on web" is an ordinary session, not a future offline-sync scenario.
2. **ADR-0002's central claim is unbacked.** It promises delta sync needing "no backend rework." Sync requires conflict _detection_; the field that would provide it is decorative.
3. **A column that looks like a guarantee and isn't is worse than no column.** It is documented as sync-ready, it is incremented diligently, and a future engineer — including the present one in a year — will reasonably assume it does something. That assumption would be discovered only after edits had already been lost.

The choice was therefore binary: make `version` mean what it claims, or delete it and delete the claim with it.

## Decision

**Implement optimistic concurrency.** `version` becomes a real precondition, not an ornament.

### Transport: a body field, not `If-Match`

Clients send `expectedVersion?: number` in the request body of `PATCH`/`DELETE`, added to each module's `*UpdateInput` schema in `packages/contracts`.

`If-Match` is the more HTTP-idiomatic choice and was rejected anyway, for two reasons specific to this codebase. Architecture Rule 4 asks of every design, "would this work unchanged if the caller were a Telegram bot or an MCP client?" — a header is HTTP machinery, a body field is transport-agnostic. And the Dart generator (ADR-0013) walks contract schemas and emits typed models, so a body field reaches the mobile client for free, where a header needs hand-written plumbing in all 8 mobile repositories — precisely the manual drift that generation exists to eliminate.

### Enforcement: optional now, with an adoption log, flippable later

The field is `.optional()`. When it is absent the write proceeds exactly as today, **and** core emits a `concurrency.unversioned_write` warn carrying the entity name and route.

It is not mandatory on day one because **a Cafe Bazaar client cannot be force-updated** (review finding R-3: store-review latency is the real deploy cadence). Requiring the field the moment the server deploys would make every already-installed APK return `400 VALIDATION_ERROR` on every edit, unfixable by the user until a store review lands. The adoption log converts "are all clients sending it yet?" from a guess into an observation; when it goes quiet, the schema flips to required in its own change.

### Enforcement point: inside the write, never between a read and a write

The comparison happens in the `UPDATE`'s `WHERE` clause:

```ts
prisma.habit.update({
  where: { id, version: expectedVersion },
  data: { ...data, version: { increment: 1 } },
});
```

Prisma 6.2.1 supports this — `HabitWhereUniqueInput` is `Prisma.AtLeast<{ id?, …, version? }, "id">`, so a non-unique filter may accompany the unique one. It returns the updated row, so no follow-up read is needed on the happy path.

**The obvious-looking alternative is wrong and was written down before being caught:**

```ts
const entity = await this.getOwned(id, userId); // both requests read v3
if (entity.version !== expectedVersion) throw Conflict; // both pass
await this.repository.update(id, data); // both write
```

That is check-then-act. Two concurrent requests both observe version 3, both pass the check, and both write — reproducing the exact lost update the feature exists to prevent, while appearing to fix it. Optimistic concurrency is only ever correct when the compare and the write are one atomic statement.

### Error path: `P2025` is ambiguous and must be disambiguated

A zero-row match throws Prisma's `P2025`, which means either "version mismatch" or "row deleted concurrently." A sync client must not confuse them: 409 means _refetch and retry_, 404 means _it is gone, stop retrying_. Conflating them makes a client retry forever against a deleted row.

The repository re-reads by id **on the failure path only** and throws accordingly. This costs nothing on the happy path.

Following the precedent `TaskLabelRepository` already set for `P2002` — commented "translated from Prisma's P2002 so `packages/core` never touches a Prisma error" — the repository throws a `@lifeos/db` error (`VersionConflictError`), and `OwnedResourceCrud` translates it to core's `ConflictError`.

### Scope: every owned resource, and `delete` as well as `update`

All seven services composing `OwnedResourceCrud.update`, plus `LabelService`'s deliberate bypass path. Uniform rather than targeted: the field is optional, so breadth is nearly free, and a partial rollout recreates the "protection that applies only where someone remembered" failure this ADR exists to end.

`delete` is covered because the stale delete is the **worse** half. Device B deleting a task at version 3, unaware device A just edited it to version 4, destroys that edit with no trace in any UI. The client always holds the version — it is rendering the row it is about to delete.

### 409 payload: `{ currentVersion }`, and nothing more

`ConflictError` gains the `details` parameter its base class `AppError` already accepts, and `ErrorEnvelope` already exposes. A new `ConflictDetails` schema in `packages/contracts` types it as `{ currentVersion: number }`.

Returning the full current entity was rejected: every module's entity shape differs, so `details` would stay `unknown` and every client would cast at the call site — making the error path the one place in the API where response typing degrades, and reintroducing exactly the shape-drift that generated clients (ADR-0013) exist to remove. Clients refetch to render the other device's changes regardless, and both clients' caches already do that on invalidation.

## Alternatives Considered

### Delete the `version` column entirely

- Pros: cheapest honest option. Removes a field implying a guarantee no code provides, and the sync-ready claim with it.
- Cons: a migration across every user-data table; ADR-0002 needs rewriting; and multi-device sync is an explicitly wanted future capability, so the column would have to come back.
- Rejected: the mobile client already exists, so concurrent edits are a present-tense problem, not a deferred one.

### Mandatory `expectedVersion` from day one

- Pros: a real guarantee immediately, no half-state, no second migration.
- Cons: breaks every installed Android build until a store review lands, with no path for the user to fix it.
- Rejected: see R-3. The adoption log gets to the same destination without stranding users.

### Optional permanently, with no plan to require it

- Pros: no migration, ever.
- Cons: the guarantee becomes "whatever each client remembered to send," which is the same class of problem as a version column nothing reads — one level up.
- Rejected: it would make this ADR self-defeating.

### Last-write-wins with an audit trail instead of rejection

- Pros: never blocks a user's write; the audit log already records every mutation, so a lost edit is at least _recoverable_ by an operator.
- Cons: recovery requires someone to notice, read `audit_logs`, and hand-restore — no client can detect the loss, which is the actual requirement.
- Rejected: it addresses forensics, not correctness.

## Consequences

- `version` now means something. ADR-0002's delta-sync claim is backed by a mechanism rather than a convention.
- Clients gain a real conflict signal and can implement retry/merge UX when they choose to; until they send the field, behaviour is unchanged.
- The `concurrency.unversioned_write` log is the gate for a future change flipping the field to required. That change is deliberately **not** made here.
- `OwnedCrudRepository.update`/`softDelete` grow an optional third parameter, so the 18 repositories and their in-memory test fakes change signature. Existing callers that omit it compile and behave as before.
- One extra read occurs on the conflict path only.
- **Not addressed here:** conflict _resolution_. This ADR gives clients the ability to detect a conflict, not a merge strategy. Field-level merge, three-way merge, and last-writer-with-notification are all still open, and belong with the offline-sync work rather than ahead of it.

## Follow-up: client adoption (2026-07-30)

Both clients now send the field, which is what turns the mechanism from present to live. Three things surfaced during adoption that this ADR did not anticipate, recorded here rather than in a new ADR because none of them changes a decision above:

1. **The version sent must be the version displayed.** The obvious implementation — read the row, then write with what you just read — type-checks, compiles, and is wrong: it fabricates a precondition describing a state the user never saw, so it passes the check exactly when the check should fail. Two places needed real design because of this: the Calendar agenda (whose rows had no `version` at all, so `CalendarOccurrenceResponse`/`CalendarEventItemResponse` gained one) and `EventFormDialog` (which uses the version from its per-open fetch, the one that populated the form).

2. **Optional on the wire does not mean optional in the client.** The distribution constraint that forces `.optional()` applies to builds already installed, not to code being written now. Both clients therefore make the field required at their own boundary — `Versioned<T>` on web, a `{required int expectedVersion}` named argument on mobile — so a future screen cannot silently take the last-write-wins path. The adoption log then measures only what it was meant to: genuinely old clients.

3. **`{ currentVersion }` turned out to be load-bearing, not informational.** `CONFLICT` is raised by three unrelated server paths (concurrency, replayed `Idempotency-Key`, duplicate label name). Without a discriminator a client can see _that_ it conflicted but not _why_, and has no correct message to show — "someone else changed this" is false for a duplicate label name. The payload is what makes the 409 actionable, which is a stronger justification than the one given above.

A fourth, smaller finding: mobile's mutation call sites had no error handling at all, so a 409 would have thrown into the zone and shown the user nothing. Detecting a conflict is worthless if the detection is invisible; `runMutation` was extracted from the pattern `settings_screen.dart` already used.
