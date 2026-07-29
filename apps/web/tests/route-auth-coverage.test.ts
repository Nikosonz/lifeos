import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Every /api/v1 route must authenticate, except an explicit allowlist.
 *
 * Ownership itself is well covered: every owned-resource read goes through
 * OwnedResourceCrud.getOwned, and packages/core tests cross-user rejection
 * centrally. But all of that only runs once a route has established WHO the
 * caller is. A handler that simply never calls requireUser has no failing
 * unit test to catch it — the service is never reached with the wrong user,
 * it is reached with no user at all — and it is a full horizontal-privilege
 * break the moment it ships.
 *
 * This is a static check, not a behavioural one, and it is worth being
 * precise about what that buys and what it doesn't:
 *
 *   - It CATCHES the realistic failure: a new route file, written by copying
 *     a neighbour, that drops the `requireUser` line. That is the way this
 *     bug actually gets introduced.
 *   - It does NOT prove authorization is correct — a route could call
 *     requireUser and then ignore the userId it returns. Nothing here would
 *     notice.
 *
 * It runs under `npm test`, which means it runs in CI on every PR. A
 * request-level equivalent would be stronger, but it would live in the
 * Playwright suite, which CI does not currently run — a stronger assertion
 * nobody executes is worth less than a weaker one that always does.
 */

const API_ROOT = join(import.meta.dirname, "..", "src", "app", "api");

/**
 * Routes that are unauthenticated BY DESIGN — the endpoints you use before
 * you have a token. Each is per-IP rate limited precisely because it cannot
 * be protected by a Bearer check (runRoute applies limits before any
 * identity exists).
 *
 * Adding an entry here should be a deliberate, reviewed act. If a route
 * appears in this list that you did not expect, that is the finding.
 */
const PUBLIC_ROUTES = new Set(["v1/auth/request-otp", "v1/auth/verify-otp", "v1/auth/refresh"]);

function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findRouteFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/** "v1/finance/wallets/[id]/route.ts" -> "v1/finance/wallets/[id]" */
function routeIdOf(file: string): string {
  return relative(API_ROOT, file).split(sep).slice(0, -1).join("/");
}

const routeFiles = findRouteFiles(API_ROOT);

test("the API surface is non-empty (guards against a broken glob)", () => {
  // Without this, deleting the app directory or breaking the path would make
  // every assertion below vacuously pass.
  assert.ok(
    routeFiles.length >= 30,
    `expected the full /api/v1 surface, found ${routeFiles.length} route files`,
  );
});

test("every route authenticates, except the documented public ones", () => {
  const unauthenticated: string[] = [];

  for (const file of routeFiles) {
    const routeId = routeIdOf(file);
    const source = readFileSync(file, "utf8");
    const authenticates = source.includes("requireUser");

    if (PUBLIC_ROUTES.has(routeId)) {
      // A public route that starts authenticating is not a security
      // problem, but it does mean this list is stale — and a stale
      // allowlist is how a genuinely unprotected route eventually hides.
      assert.ok(
        !authenticates,
        `${routeId} is on the public allowlist but calls requireUser — remove it from PUBLIC_ROUTES`,
      );
      continue;
    }

    if (!authenticates) unauthenticated.push(routeId);
  }

  assert.deepEqual(
    unauthenticated,
    [],
    `these routes never call requireUser and are not on the public allowlist:\n  ${unauthenticated.join("\n  ")}`,
  );
});

test("every public route is rate limited, since it cannot be Bearer-protected", () => {
  const unlimited: string[] = [];

  for (const file of routeFiles) {
    const routeId = routeIdOf(file);
    if (!PUBLIC_ROUTES.has(routeId)) continue;
    // runRoute's options form is the only way a route applies a limit.
    if (!readFileSync(file, "utf8").includes("rateLimit")) unlimited.push(routeId);
  }

  assert.deepEqual(
    unlimited,
    [],
    `public routes with no rate limit — the only abuse control they can have:\n  ${unlimited.join("\n  ")}`,
  );
});

test("every dynamic-segment route validates its params", () => {
  const unvalidated: string[] = [];

  for (const file of routeFiles) {
    const routeId = routeIdOf(file);
    if (!routeId.includes("[")) continue;
    const source = readFileSync(file, "utf8");
    // Reading `await ctx.params` raw hands unvalidated input to Prisma,
    // which turns a client typo into a 500 with a stack trace instead of a
    // 400 — the gap Phase 5 closed with uuidParams.
    if (!source.includes("uuidParams")) unvalidated.push(routeId);
  }

  assert.deepEqual(
    unvalidated,
    [],
    `dynamic routes not using uuidParams:\n  ${unvalidated.join("\n  ")}`,
  );
});
