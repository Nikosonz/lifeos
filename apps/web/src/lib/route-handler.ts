import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitService, toErrorEnvelope, ValidationError } from "@lifeos/core";
import type { RateLimitRule } from "@lifeos/core";
import { clientIpFromRequest } from "./client-ip";
import { requireUser } from "./auth-context";

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

/**
 * Reads a JSON body that may be absent.
 *
 * An empty body becomes `{}` rather than an error, so the *schema* decides
 * whether that is acceptable: a schema with required fields rejects it with a
 * normal VALIDATION_ERROR naming them, and an all-optional schema (a DELETE
 * carrying only `expectedVersion`) parses cleanly. One behaviour, correct
 * outcome either way, and no route needs to know which case it is in.
 *
 * Malformed JSON is a 400. It used to be a 500: `req.json()` throws a bare
 * SyntaxError, which is neither an AppError nor a ZodError, so it fell past
 * both branches of `toErrorEnvelope` into the catch-all — a server error for
 * a request that is unambiguously the client's mistake. That bug existed at
 * 29 call sites because parsing was every route's own job; it exists at one
 * now.
 */
async function readJsonBody(req: NextRequest): Promise<unknown> {
  const raw = await req.text();
  if (raw.trim() === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Request body is not valid JSON");
  }
}

type ParamNames = readonly string[];

type RouteSpec<TParams extends ParamNames, TBody> = {
  /**
   * Dynamic segment names, e.g. `["id"]` or `["id", "subtaskId"]`. Every
   * segment in this API is a uuid — there is no route where a non-uuid
   * segment would be legitimate — so naming them is all a route has to do.
   */
  params?: TParams;
  /** Contract schema for the request body. Omit for routes that take none. */
  body?: z.ZodType<TBody>;
  /** Per-IP limit. Rarely needed here: defineRoute always authenticates. */
  rateLimit?: { bucket: string; rule: RateLimitRule };
};

type RouteContext<TParams extends ParamNames, TBody> = {
  userId: string;
  params: { [K in TParams[number]]: string };
  body: TBody;
  req: NextRequest;
  requestId: string;
};

/**
 * Declarative definition for an authenticated `/api/v1` route.
 *
 * `runRoute` was shallow: its interface handed a caller `(req, requestId, ctx)`
 * — three raw things — and every one of 37 route files then re-implemented the
 * same preamble. `requireUser` appeared 34 times, path-param validation 13, and
 * `Schema.parse(await req.json())` 29. A defect in any one of those steps had
 * that many places to live, which is exactly how the malformed-body 500 came
 * to affect 27 files at once.
 *
 * Absorbing those steps deleted two modules outright — `lib/path-params.ts` and
 * `lib/optional-body.ts` — because each existed only to be called identically
 * from every route. That is the deletion test passing in the useful direction:
 * complexity concentrated here rather than moving somewhere else.
 *
 * Here a route states what it needs and receives it, already validated:
 *
 *     export const PATCH = defineRoute(
 *       { params: ["id"], body: HabitUpdateInput },
 *       async ({ userId, params, body }) => { ... },
 *     );
 *
 * **This always authenticates.** The three genuinely public routes
 * (`request-otp`, `verify-otp`, `refresh`) keep the plain `runRoute` form, so
 * "which routes are unauthenticated" is answerable by grep rather than by
 * reading a boolean on each one — and `route-auth-coverage.test.ts` asserts
 * exactly that split.
 *
 * `requestId` is passed through to the handler. It was generated and then
 * discarded as `_requestId` in 34 of 37 files; it still cannot reach a core
 * service (that needs request-scoped context, a separate change), but it is at
 * least reachable by the route that wants to log with it.
 */
// `const TParams` (TS 5.0+) makes `params: ["id"]` infer as the tuple
// `readonly ["id"]` rather than widening to `string[]`. Without it the mapped
// type degrades to an index signature, and `noUncheckedIndexedAccess` then
// types every segment as `string | undefined` — pushing a null check into
// every route for a value the router guarantees.
export function defineRoute<const TParams extends ParamNames = readonly [], TBody = undefined>(
  spec: RouteSpec<TParams, TBody>,
  handler: (ctx: RouteContext<TParams, TBody>) => Promise<unknown>,
): (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse> {
  const options: RouteOptions = spec.rateLimit ? { rateLimit: spec.rateLimit } : {};

  return runRoute<{ params: Promise<Record<string, string>> }>(
    options,
    async (req, requestId, ctx) => {
      const { userId } = await requireUser(req);

      let params = {} as { [K in TParams[number]]: string };
      if (spec.params && spec.params.length > 0) {
        const resolved = await ctx.params;
        // Shape is built from the declared names, not the resolved keys, so a
        // route that declares a segment Next never supplies fails loudly here
        // instead of passing `undefined` down to Prisma.
        const shape = Object.fromEntries(spec.params.map((key) => [key, z.uuid()]));
        params = z.object(shape).parse(resolved) as { [K in TParams[number]]: string };
      }

      const body = spec.body
        ? spec.body.parse(await readJsonBody(req))
        : (undefined as unknown as TBody);

      return handler({ userId, params, body, req, requestId });
    },
  );
}
