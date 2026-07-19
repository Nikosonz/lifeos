import { z } from "zod";

// Cursor pagination only — no offset/page-number params. Cursors are the
// `updatedAt` of the last item on the page, so mobile/offline clients can
// later reuse the same param as a sync-delta cursor.
export const CursorQuery = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorQuery = z.infer<typeof CursorQuery>;

export function paginatedResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().datetime().nullable(),
  });
}
