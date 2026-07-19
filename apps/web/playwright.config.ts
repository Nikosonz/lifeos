import { defineConfig, devices } from "@playwright/test";

// Real browser, real dev server, real (dockerized) Postgres. Requires the
// same prerequisites as .claude/skills/verify/SKILL.md: docker compose up,
// then `npm run dev > /tmp/lifeos-web-dev.log 2>&1 &` in apps/web — the mock
// SMS provider logs the OTP code there, and e2e/login.spec.ts reads it from
// that same path. No `webServer` block here on purpose: starting/stopping
// the dev server per-run would race with reading its log file for the code.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // OTP requests share a per-phone cooldown; keep sequential
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
