import { randomUUID } from "node:crypto";

/**
 * A phone number no other test row can collide with.
 *
 * `User.phone` is unique, and every real-Postgres test file creates its own
 * user. These files run in PARALLEL under `node --test`, so uniqueness has to
 * hold across files, not just within one.
 *
 * The previous approach — a distinct hand-assigned prefix per file plus
 * `Date.now()` — failed exactly the way hand-assigned identifiers do: two files
 * were given `+98902`, and the collision only surfaced when their `before()`
 * hooks happened to land in the same millisecond. It passed for days first.
 *
 * A uuid is unique by construction, so there is no convention left to violate
 * and no new file to remember to give a fresh prefix.
 */
export function uniquePhone(): string {
  return `+98${randomUUID()}`;
}
