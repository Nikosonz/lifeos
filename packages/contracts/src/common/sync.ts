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
