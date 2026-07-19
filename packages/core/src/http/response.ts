import { z } from "zod";
import type { ErrorEnvelope } from "@lifeos/contracts";
import { AppError } from "../errors/app-error";
import { logger } from "../logging/logger";

// The one place that turns "anything thrown" into the wire error envelope.
// Route handlers in apps/web call this from a catch block; it is the only
// path Next's route handlers use, so every client (web today, Android/
// Telegram/MCP later) sees an identical error shape.
export function toErrorEnvelope(
  err: unknown,
  requestId: string,
): { status: number; body: ErrorEnvelope } {
  if (err instanceof AppError) {
    return {
      status: err.httpStatus,
      body: {
        error: { code: err.code, message: err.message, details: err.details },
        requestId,
      },
    };
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

  logger.error({ err, requestId }, "unhandled error");
  return {
    status: 500,
    body: {
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      requestId,
    },
  };
}
