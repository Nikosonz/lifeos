import { z } from "zod";
import type { ErrorEnvelope } from "@lifeos/contracts";
import { AppError, RateLimitedError } from "../errors/app-error";
import { logger } from "../logging/logger";

// The one place that turns "anything thrown" into the wire error envelope.
// Route handlers in apps/web call this from a catch block; it is the only
// path Next's route handlers use, so every client (web today, Android/
// Telegram/MCP later) sees an identical error shape.
//
// `headers` exists so response *headers* an error implies stay derived
// here too, alongside the status and body, rather than route handlers
// re-inspecting the caught error themselves — today that's Retry-After on
// a 429, which is part of the HTTP contract but has no place in the
// ErrorEnvelope body schema.
export function toErrorEnvelope(
  err: unknown,
  requestId: string,
): { status: number; body: ErrorEnvelope; headers?: Record<string, string> } {
  if (err instanceof AppError) {
    const envelope = {
      status: err.httpStatus,
      body: {
        error: { code: err.code, message: err.message, details: err.details },
        requestId,
      },
    };
    if (err instanceof RateLimitedError && err.retryAfterSeconds !== undefined) {
      return { ...envelope, headers: { "retry-after": String(err.retryAfterSeconds) } };
    }
    return envelope;
  }

  if (err instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request payload",
          details: err.issues,
        },
        requestId,
      },
    };
  }

  logger.error({ event: "unhandled_error", err, requestId }, "unhandled error");
  return {
    status: 500,
    body: {
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      requestId,
    },
  };
}
