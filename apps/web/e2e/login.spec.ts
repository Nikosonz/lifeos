import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Reads the mock SMS provider's log line to get the OTP code — see
// packages/core/src/auth/adapters/mock-sms-provider.ts and
// .claude/skills/verify/SKILL.md for why this is the intended dev/CI flow
// (no real SMS provider is wired up yet).
//
// Repo-relative path, deliberately not /tmp: Playwright runs as a native
// Windows Node process, while the dev server is typically started from
// Git-Bash — the two runtimes resolve "/tmp" to different real
// directories, so a path under /tmp written by one is invisible to the
// other. A path relative to the repo is unambiguous for both.
const DEV_LOG_PATH = path.resolve(import.meta.dirname, "../.tmp/dev.log");

function readOtpCodeFromLog(phone: string): string {
  const log = readFileSync(DEV_LOG_PATH, "utf8");
  const escaped = phone.replace(/[+]/g, "\\+");
  const matches = [...log.matchAll(new RegExp(`"phone":"${escaped}","code":"(\\d{6})"`, "g"))];
  const last = matches.at(-1);
  if (!last) throw new Error(`No OTP code found in ${DEV_LOG_PATH} for ${phone}`);
  return last[1]!;
}

function freshPhone(): string {
  // Unique per run — OTP codes are single-use and per-phone rate-limited.
  return `+989${Date.now().toString().slice(-9)}`;
}

test("logs in with a valid OTP code", async ({ page }) => {
  const phone = freshPhone();

  await page.goto("/fa/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.getByLabel("شماره موبایل").fill(phone);
  await page.getByRole("button", { name: "دریافت کد" }).click();

  await expect(page.getByLabel("کد تایید")).toBeVisible();

  const code = readOtpCodeFromLog(phone);
  await page.getByLabel("کد تایید").fill(code);
  await page.getByRole("button", { name: "ورود", exact: true }).click();

  await expect(page.getByText("ورود موفق بود")).toBeVisible();
});

test("shows an error for an incorrect code", async ({ page }) => {
  const phone = freshPhone();

  await page.goto("/fa/login");
  await page.getByLabel("شماره موبایل").fill(phone);
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await expect(page.getByLabel("کد تایید")).toBeVisible();

  await page.getByLabel("کد تایید").fill("000000");
  await page.getByRole("button", { name: "ورود", exact: true }).click();

  // Not getByRole("alert") — Next's own route-announcer div also carries
  // role="alert" (id="__next-route-announcer__"), so that locator resolves
  // to two elements and fails Playwright's strict mode. Found by running
  // this test, not by reading the source.
  await expect(page.getByText("Incorrect code")).toBeVisible();
});
