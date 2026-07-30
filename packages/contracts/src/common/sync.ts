import { z } from "zod";

// Every user-data entity carries these so mobile/offline clients (Android,
// iOS, later) can sync via delta queries without any backend changes —
// see CLAUDE.md "Sync-ready" convention. `deletedAt` means soft delete:
// list endpoints filter it out server-side, sync endpoints do not.
export const SyncFields = z.object({
  id: z.uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  version: z.number().int(),
});
export type SyncFields = z.infer<typeof SyncFields>;

export const IdempotencyKeyHeader = z.uuid();

/**
 * Optimistic-concurrency precondition — see ADR-0020.
 *
 * A client that read an entity at `version: 3` sends `expectedVersion: 3` back
 * with its update or delete; the server compares it inside the write itself
 * and returns 409 if anything moved in between. Without it the write proceeds
 * (last-write-wins) and the server logs `concurrency.unversioned_write`.
 *
 * Optional deliberately, and NOT because conflicts are optional: an installed
 * Cafe Bazaar build cannot be force-updated, so requiring the field would make
 * every already-shipped APK fail every edit until a store review lands. The
 * log is how adoption gets measured before this is flipped to required.
 *
 * A body field rather than `If-Match` so it survives a non-HTTP caller
 * (Telegram, MCP) and so the Dart generator picks it up for free — see the ADR
 * for why the more HTTP-idiomatic header was rejected anyway.
 */
export const ExpectedVersion = z.number().int().positive().optional();

/**
 * Body schema for DELETE routes, which otherwise take none.
 *
 * Routes must tolerate a completely absent body here — `req.json()` throws a
 * SyntaxError on empty input, and every existing client sends no body at all.
 */
export const VersionedDeleteInput = z.object({ expectedVersion: ExpectedVersion });
export type VersionedDeleteInput = z.infer<typeof VersionedDeleteInput>;
