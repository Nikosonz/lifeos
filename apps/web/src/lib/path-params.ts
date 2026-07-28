import { z } from "zod";

// Closes the one real validation gap the Phase 5 audit found: request
// bodies and query strings were 100% Zod-parsed via @lifeos/contracts, but
// `[id]` path segments went straight from Next's route params into a core
// service and on to Prisma. A malformed id therefore surfaced as a Prisma
// error — a 500 INTERNAL_ERROR for what is plainly a client mistake, and
// one that logs a stack trace on every bot probing for `/api/v1/tasks/1`.
//
// Every dynamic segment in this API is a uuid (`[id]`, `[subtaskId]`), so
// this validates all of them rather than taking a list of key names —
// there is no route where a non-uuid segment would be legitimate, and a
// helper that can't express one can't be misapplied to one.
//
// Throws ZodError, which runRoute's catch turns into the standard
// VALIDATION_ERROR 400 envelope — no route handler catches this itself,
// same rule as body parsing (see CLAUDE.md's Module Pattern step 4).
export async function uuidParams<T extends Record<string, string>>(params: Promise<T>): Promise<T> {
  const resolved = await params;
  const shape = Object.fromEntries(Object.keys(resolved).map((key) => [key, z.uuid()]));
  // Built from the resolved keys so ZodError's `path` names the offending
  // segment ("subtaskId", not just "invalid uuid") in the error details.
  return z.object(shape).parse(resolved) as T;
}
