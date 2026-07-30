import type { ErrorCode } from "@lifeos/contracts";

// The one place HTTP status <-> error code mapping is decided. Route
// handlers never invent status codes from a caught error — they call
// `toHttpStatus` on whatever AppError subclass core throws.
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  get httpStatus(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Not allowed to perform this action") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  // `details` carries ConflictDetails ({ currentVersion }) for an
  // optimistic-concurrency failure (ADR-0020); the duplicate-name conflicts
  // that predate it pass nothing and stay message-only.
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, details);
    this.name = "ConflictError";
  }
}

export class RateLimitedError extends AppError {
  // Whole seconds, per RFC 9110 §10.2.3. Optional because not every
  // rejection knows when the caller may retry (OtpService's max-attempts
  // lockout, for instance, clears by requesting a *new* code, not by
  // waiting) — toErrorEnvelope only emits a Retry-After header when this
  // is set, rather than inventing a number the client would then trust.
  readonly retryAfterSeconds?: number;

  constructor(message = "Too many requests", retryAfterSeconds?: number) {
    super("RATE_LIMITED", message);
    this.name = "RateLimitedError";
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}
