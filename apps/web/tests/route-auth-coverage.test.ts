import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Every /api/v1 route must authenticate, except an explicit allowlist.
 *
 * This used to grep each file for the string `requireUser`, which was the best
 * available check while every route hand-wrote its own preamble. It is now a
 * structural one: `defineRoute` ALWAYS authenticates — there is no flag to turn
 * that off — so "this route uses defineRoute" is a guarantee rather than a hint
 * that the right function name appears somewhere in the file.
 *
 * The distinction matters. The old assertion passed for a route that called
 * requireUser and then ignored the userId it returned. This one can still be
 * defeated the same way, but the surface for it is one shared module rather
 * than 34 hand-written preambles.
 *
 * It runs under `npm test`, so it runs in CI on every PR. A request-level
 * equivalent would be stronger but would live in the Playwright suite, which
 * CI does not run — and a stronger assertion nobody executes is worth less
 * than a weaker one that always does.
 */

const API_ROOT = join(import.meta.dirname, "..", "src", "app", "api");

/**
 * Routes that are unauthenticated BY DESIGN — the endpoints you use before you
 * have a token. Each is per-IP rate limited precisely because it cannot be
 * protected by a Bearer check.
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

/** The dynamic segments a route actually has, read from its directory path. */
function segmentsOf(routeId: string): string[] {
  return [...routeId.matchAll(/\[(\w+)\]/g)].map((m) => m[1]!);
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
    // defineRoute authenticates unconditionally; runRoute does not.
    const authenticates = /=\s*defineRoute\(/.test(source);

    if (PUBLIC_ROUTES.has(routeId)) {
      // A public route that starts authenticating is not a security problem,
      // but it does mean this list is stale — and a stale allowlist is how a
      // genuinely unprotected route eventually hides.
      assert.ok(
        !authenticates,
        `${routeId} is on the public allowlist but uses defineRoute — remove it from PUBLIC_ROUTES`,
      );
      continue;
    }

    if (!authenticates) unauthenticated.push(routeId);
  }

  assert.deepEqual(
    unauthenticated,
    [],
    `these routes are not defined with defineRoute and are not on the public allowlist:\n  ${unauthenticated.join("\n  ")}`,
  );
});

test("every public route is rate limited, since it cannot be Bearer-protected", () => {
  const unlimited: string[] = [];

  for (const file of routeFiles) {
    const routeId = routeIdOf(file);
    if (!PUBLIC_ROUTES.has(routeId)) continue;
    if (!readFileSync(file, "utf8").includes("rateLimit")) unlimited.push(routeId);
  }

  assert.deepEqual(
    unlimited,
    [],
    `public routes with no rate limit — the only abuse control they can have:\n  ${unlimited.join("\n  ")}`,
  );
});

test("every dynamic route declares exactly the segments it actually has", () => {
  // Stronger than the old "does the file mention uuidParams" check: it compares
  // the declared `params: [...]` against the segment names in the directory
  // path, so a route sitting at [taskId] that declares ["id"] fails here rather
  // than handing `undefined` to Prisma at runtime.
  const problems: string[] = [];

  for (const file of routeFiles) {
    const routeId = routeIdOf(file);
    const segments = segmentsOf(routeId);
    if (segments.length === 0) continue;

    const source = readFileSync(file, "utf8");
    const declaredLists = [...source.matchAll(/params:\s*\[([^\]]*)\]/g)].map((m) =>
      [...m[1]!.matchAll(/"(\w+)"/g)].map((s) => s[1]!),
    );

    if (declaredLists.length === 0) {
      problems.push(`${routeId}: has segments [${segments}] but declares no params`);
      continue;
    }
    for (const declared of declaredLists) {
      if (declared.join(",") !== segments.join(",")) {
        problems.push(`${routeId}: declares [${declared}] but its path has [${segments}]`);
      }
    }
  }

  assert.deepEqual(
    problems,
    [],
    `params declarations out of step with the route path:\n  ${problems.join("\n  ")}`,
  );
});

test("no route parses its own body — that belongs to defineRoute", () => {
  // The malformed-body 500 existed at 29 call sites because every route did its
  // own `await req.json()`. Keeping that at zero is what stops it coming back
  // one convenient copy-paste at a time.
  const offenders: string[] = [];

  for (const file of routeFiles) {
    const routeId = routeIdOf(file);
    if (PUBLIC_ROUTES.has(routeId)) continue;
    if (readFileSync(file, "utf8").includes("req.json()")) offenders.push(routeId);
  }

  assert.deepEqual(
    offenders,
    [],
    `these routes parse their own body instead of declaring a \`body\` schema:\n  ${offenders.join("\n  ")}`,
  );
});
