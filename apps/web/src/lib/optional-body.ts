import type { NextRequest } from "next/server";
import { ValidationError } from "@lifeos/core";

/**
 * Reads a request body that may legitimately be absent.
 *
 * DELETE routes took no body at all until `expectedVersion` (ADR-0020), and
 * every already-shipped client still sends none. `req.json()` throws a bare
 * `SyntaxError` on empty input, which is neither an `AppError` nor a
 * `ZodError`, so it falls past both branches of `toErrorEnvelope` into the
 * catch-all and surfaces as a 500 — a server error for a request that is
 * perfectly valid.
 *
 * Returning `{}` for an empty body keeps every existing client working while
 * letting the schema's optional field parse when a newer client does send one.
 *
 * Malformed (rather than absent) JSON becomes a 400 here instead of the same
 * 500. That is a narrow instance of a wider gap: 29 `await req.json()` call
 * sites across 27 route files still turn a truncated body into a server error.
 * Fixing that properly belongs in `runRoute` itself — see the deepening work
 * this repo has queued — not in 27 hand-edits.
 */
export async function optionalJsonBody(req: NextRequest): Promise<unknown> {
  const raw = await req.text();
  if (raw.trim() === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Request body is not valid JSON");
  }
}
