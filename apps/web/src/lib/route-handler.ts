import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { rateLimitService, toErrorEnvelope } from "@lifeos/core";
import type { RateLimitRule } from "@lifeos/core";
import { clientIpFromRequest } from "./client-ip";

type RouteResult = unknown | NextResponse;

type RouteHandler<Ctx> = (req: NextRequest, requestId: string, ctx: Ctx) => Promise<RouteResult>;

export type RouteOptions = {
  /**
   * Per-IP rate limit for this route. Omitted on most routes: they're
   * Bearer-authenticated, so the cheap abuse vectors are the handful of
   * unauthenticated auth endpoints, and a blanket per-IP cap would
   * misfire on shared/NATed IPs (common in Iran) for no real gain. The
   * rules themselves come from @lifeos/core's RATE_LIMITS — routes name a
   * policy, they don't invent numbers.
   */
  rateLimit?: { bucket: string; rule: RateLimitRule };
};

// A handler is always `typeof "function"`, so "is it an object" fully
// separates the two overloads.
function isRouteOptions(value: unknown): value is RouteOptions {
  return typeof value === "object" && value !== null;
}

// Every /api/v1 route handler is wrapped in this: generates a requestId,
// forwards it on the response, and turns whatever core throws into the
// same error envelope shape for every route — see @lifeos/core toErrorEnvelope.
// `Ctx` carries Next's second route-handler argument through for dynamic
// segments (e.g. `{ params: Promise<{ id: string }> }`). Defaults to the
// empty-params shape Next 16's build-time route validator expects on every
// handler, even non-dynamic ones — a literal `undefined` default fails
// `next build`'s generated type check.
//
// Overloaded so the overwhelmingly common `runRoute(handler)` form is
// unchanged — adding rate limiting to a route is opt-in via the leading
// options argument, and every existing call site kept compiling untouched.
export function runRoute<Ctx = { params: Promise<Record<string, never>> }>(
  handler: RouteHandler<Ctx>,
): (req: NextRequest, ctx: Ctx) => Promise<NextResponse>;
export function runRoute<Ctx = { params: Promise<Record<string, never>> }>(
  options: RouteOptions,
  handler: RouteHandler<Ctx>,
): (req: NextRequest, ctx: Ctx) => Promise<NextResponse>;
export function runRoute<Ctx = { params: Promise<Record<string, never>> }>(
  optionsOrHandler: RouteOptions | RouteHandler<Ctx>,
  maybeHandler?: RouteHandler<Ctx>,
) {
  // Branching on the same type guard for both bindings lets TS narrow each
  // one properly, rather than casting a union that includes a function
  // into the handler slot.
  const options = isRouteOptions(optionsOrHandler) ? optionsOrHandler : {};
  const handler = isRouteOptions(optionsOrHandler) ? maybeHandler! : optionsOrHandler;

  return async (req: NextRequest, ctx: Ctx) => {
    const requestId = randomUUID();
    try {
      // Before the handler, so a limited request never reaches the
      // service (or, for request-otp, never costs an SMS). RateLimitedError
      // lands in the same catch below as anything else core throws, so the
      // 429 envelope and its Retry-After need no special case here.
      if (options.rateLimit) {
        const { bucket, rule } = options.rateLimit;
        await rateLimitService.consume(bucket, clientIpFromRequest(req), rule);
      }

      const result = await handler(req, requestId, ctx);
      if (result instanceof NextResponse) {
        result.headers.set("x-request-id", requestId);
        return result;
      }
      return NextResponse.json(result, { headers: { "x-request-id": requestId } });
    } catch (err) {
      const { status, body, headers } = toErrorEnvelope(err, requestId);
      return NextResponse.json(body, {
        status,
        headers: { ...headers, "x-request-id": requestId },
      });
    }
  };
}
