import { z } from "zod";

// Error codes are stable, machine-readable strings — clients (mobile, bots,
// MCP) branch on `code`, never on `message` (which may be localized later).
export const ErrorCode = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorEnvelope = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
  requestId: z.string(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

/**
 * `details` shape on a CONFLICT raised by an optimistic-concurrency failure
 * (ADR-0020). `currentVersion` is what the server holds now, so a client can
 * tell a one-version-behind race from a badly stale cached copy.
 *
 * Deliberately not the full current entity: every module's entity shape
 * differs, so `details` would stay `unknown` and every client would cast at
 * the call site — making the error path the one place in the API where
 * response typing degrades. Clients refetch to render the other device's
 * changes anyway.
 */
export const ConflictDetails = z.object({ currentVersion: z.number().int() });
export type ConflictDetails = z.infer<typeof ConflictDetails>;
