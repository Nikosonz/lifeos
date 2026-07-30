import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger, rateLimitService, toErrorEnvelope, ValidationError } from "@lifeos/core";
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

type RouteSpec<TParams extends ParamNames, TBody, TQuery, TResponse> = {
  /**
   * Dynamic segment names, e.g. `["id"]` or `["id", "subtaskId"]`. Every
   * segment in this API is a uuid — there is no route where a non-uuid
   * segment would be legitimate — so naming them is all a route has to do.
   */
  params?: TParams;
  /** Contract schema for the request body. Omit for routes that take none. */
  body?: z.ZodType<TBody>;
  /**
   * Contract schema for the query string. Receives
   * `Object.fromEntries(searchParams)`, so every value arrives as a string and
   * the schema does its own coercion (`z.coerce.number()`), exactly as the ten
   * routes that previously hand-rolled this already did.
   */
  query?: z.ZodType<TQuery>;
  /**
   * Contract schema for the response body.
   *
   * Declaring it does two distinct things, and the second is the reason it
   * exists. It makes the handler's return type *checked at compile time*
   * against the contract — and it makes the server `.parse()` its own output,
   * so a drift that types can't catch (a runtime value outside the schema's
   * range) fails here, with a requestId in the log, instead of at whichever
   * client happened to validate.
   *
   * That gap was real, not theoretical: `SignedMoneyAmount` exists because a
   * derived balance could legitimately go negative while the response schema
   * forbade it, and nothing server-side noticed — the failure surfaced only
   * once `apiFetch` parsed a real negative value in a browser.
   *
   * Omit it only for a route that returns a `NextResponse` directly.
   */
  response?: z.ZodType<TResponse>;
  /** Per-IP limit. Rarely needed here: defineRoute always authenticates. */
  rateLimit?: { bucket: string; rule: RateLimitRule };
};

type RouteContext<TParams extends ParamNames, TBody, TQuery> = {
  userId: string;
  params: { [K in TParams[number]]: string };
  body: TBody;
  query: TQuery;
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
export function defineRoute<
  const TParams extends ParamNames = readonly [],
  TBody = undefined,
  TQuery = undefined,
  TResponse = unknown,
>(
  spec: RouteSpec<TParams, TBody, TQuery, TResponse>,
  // `NoInfer` (TS 5.4+) is load-bearing, not decoration. TResponse appears in
  // two inference positions — `spec.response` and this return type — and
  // without it TypeScript infers TResponse from whatever the handler happens to
  // return, so the constraint is satisfied by construction and checks nothing.
  // Verified rather than assumed: before this, a route returning
  // `{ habits: {id}[] }` against `response: HabitListResponse` compiled clean.
  handler: (ctx: RouteContext<TParams, TBody, TQuery>) => Promise<NoInfer<TResponse>>,
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

      const query = spec.query
        ? spec.query.parse(Object.fromEntries(req.nextUrl.searchParams))
        : (undefined as unknown as TQuery);

      const result = await handler({ userId, params, body, query, req, requestId });

      // The parsed value is what goes on the wire, not the handler's own object.
      // Zod strips keys the schema doesn't declare, so the contract — rather
      // than whatever a mapper happened to spread — decides the response shape.
      // A route that returns a NextResponse directly declares no `response` and
      // passes through untouched (runRoute forwards it as-is).
      if (!spec.response || result instanceof NextResponse) return result;

      const parsed = spec.response.safeParse(result);
      if (parsed.success) return parsed.data;

      // A response that doesn't match its own contract is a SERVER defect, and
      // must not be reported as the caller's mistake. Letting the ZodError
      // propagate would do exactly that: `toErrorEnvelope` maps every ZodError
      // to a 400 VALIDATION_ERROR, which would blame the client for a bug it
      // has no way to fix or even understand — the same inversion C1 fixed in
      // the other direction when a malformed request body was returning 500.
      logger.error(
        {
          event: "route.response_contract_violation",
          requestId,
          path: req.nextUrl.pathname,
          method: req.method,
          issues: parsed.error.issues,
        },
        "handler returned a response that violates its declared contract",
      );
      throw new Error("Response did not match its declared contract");
    },
  );
}
