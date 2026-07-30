/**
 * Compiles every page and API route the specs touch, before any test runs.
 *
 * The dev server compiles on demand, and Playwright's per-test budget is 30s
 * for a spec that drives a whole module. On a cold server the first run pays
 * Turbopack's compile cost for each page and each `/api/v1` route as the spec
 * reaches it, and the total blows the budget — so a spec "fails" on whatever
 * assertion happened to be in flight when the clock ran out. That is why the
 * failing spec differed run to run (habits, then tasks, then notifications)
 * while every one of them passed immediately on re-run against the now-warm
 * server. Three separate PRs spent a round investigating a regression that did
 * not exist.
 *
 * Warming is the fix rather than a longer timeout: it removes the cause
 * instead of waiting out the symptom, and it keeps a genuinely hung page
 * failing fast.
 *
 * Every request here is unauthenticated. API routes answer 401 and pages
 * render their client-side auth gate — neither matters, because compilation is
 * the point and it happens before the handler ever runs.
 */

const BASE = "http://localhost:3000";
const WARM_ID = "00000000-0000-4000-8000-000000000000";

const PAGES = [
  "/fa/login",
  "/fa/finance",
  "/fa/finance/wallets",
  "/fa/finance/categories",
  "/fa/finance/transactions",
  "/fa/finance/budgets",
  "/fa/tasks",
  "/fa/tasks/projects",
  "/fa/tasks/labels",
  "/fa/habits",
  "/fa/calendar",
  "/fa/notifications",
  "/fa/reports",
  "/fa/settings",
];

const API_ROUTES = [
  "/api/v1/me",
  "/api/v1/finance/wallets",
  "/api/v1/finance/categories",
  "/api/v1/finance/transactions",
  "/api/v1/finance/budgets?jalaliYear=1405&jalaliMonth=1",
  "/api/v1/finance/dashboard",
  "/api/v1/tasks",
  "/api/v1/tasks/projects",
  "/api/v1/tasks/labels",
  "/api/v1/habits",
  "/api/v1/calendar/agenda?jalaliYear=1405&jalaliMonth=1",
  "/api/v1/notifications",
  "/api/v1/reports/dashboard",
  "/api/v1/auth/sessions",
  // Dynamic segments compile per route file, not per id. A throwaway uuid is
  // enough: the request 401s before reaching a service, and compilation — the
  // only thing being bought here — has already happened by then.
  `/api/v1/habits/${WARM_ID}/checkins?jalaliYear=1405&jalaliMonth=1`,
  `/api/v1/habits/${WARM_ID}`,
  `/api/v1/tasks/${WARM_ID}/subtasks`,
  `/api/v1/tasks/${WARM_ID}`,
  `/api/v1/calendar/events/${WARM_ID}`,
  `/api/v1/finance/wallets/${WARM_ID}`,
  `/api/v1/finance/budgets/${WARM_ID}`,
  `/api/v1/finance/categories/${WARM_ID}`,
  `/api/v1/finance/transactions/${WARM_ID}`,
  `/api/v1/tasks/projects/${WARM_ID}`,
  `/api/v1/tasks/labels/${WARM_ID}`,
];

async function globalSetup(): Promise<void> {
  // Sequential, deliberately. Firing these in parallel against a cold dev
  // server corrupted Turbopack's dev manifest — every page then failed with
  // `SyntaxError: Unexpected non-whitespace character after JSON`, which is
  // far worse than the flake this exists to fix. Compilation is single-threaded
  // work anyway, so serialising costs nothing but the wall time it would have
  // spent inside the first test.
  const results: ("ok" | "failed")[] = [];
  for (const path of [...PAGES, ...API_ROUTES]) {
    try {
      await fetch(`${BASE}${path}`);
      results.push("ok");
    } catch {
      results.push("failed");
    }
  }

  try {
    // POST routes compile too. The body is deliberately invalid so the route
    // returns 400 without issuing an OTP — a valid call would burn the
    // per-identifier resend cooldown for whatever number it used.
    await fetch(`${BASE}/api/v1/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    results.push("ok");
  } catch {
    results.push("failed");
  }

  if (results.every((r) => r === "failed")) {
    throw new Error(
      `No dev server on ${BASE}. Start it first:\n` +
        `  cd apps/web && npm run dev > .tmp/dev.log 2>&1 &\n` +
        `The specs read the mock SMS provider's OTP code from that log, so it must be redirected to a file.`,
    );
  }
}

export default globalSetup;
