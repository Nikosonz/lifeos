import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Real browser, real dev server, real dockerized Postgres — same recipe as
// login.spec.ts, extended past login into the first full backend module the
// UI covers end to end. Login -> dashboard -> wallet -> categories (both
// INCOME and EXPENSE, since the type Select's filtering depends on both
// existing) -> transaction -> dashboard reflecting it -> budget. This is
// deliberately one long happy-path test, not one-test-per-page: the value
// here is proving the pieces compose (a transaction actually updates the
// dashboard total, a budget actually resolves against a real category),
// which per-page isolated tests wouldn't catch.
const DEV_LOG_PATH = path.resolve(import.meta.dirname, "../.tmp/dev.log");

function readOtpCodeFromLog(phone: string): string {
  const log = readFileSync(DEV_LOG_PATH, "utf8");
  const escaped = phone.replace(/[+]/g, "\\+");
  const matches = [...log.matchAll(new RegExp(`"phone":"${escaped}","code":"(\\d{6})"`, "g"))];
  const last = matches.at(-1);
  if (!last) throw new Error(`No OTP code found for ${phone}`);
  return last[1]!;
}

function freshPhone(): string {
  return `+989${Date.now().toString().slice(-9)}`;
}

test("full Finance vertical slice: login -> wallet -> categories -> transaction -> dashboard -> budget", async ({
  page,
}) => {
  const phone = freshPhone();

  // --- Login ---
  // Pre-seed the onboarding tour's "seen" flag so its full-screen overlay
  // (which appears 1.5s after mount on a genuinely first-ever login) can't
  // intercept clicks partway through this flow — this test is about the
  // Finance vertical slice, not the tour, which has its own coverage.
  await page.addInitScript(() => window.localStorage.setItem("lifeos:onboarding-tour-seen", "1"));
  await page.goto("/fa/login");
  await page.getByLabel("شماره موبایل").fill(phone);
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await expect(page.getByLabel("کد تایید")).toBeVisible();
  const code = readOtpCodeFromLog(phone);
  await page.getByLabel("کد تایید").fill(code);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // A fresh account now lands on the name step first (Phase 6). This spec
  // tests its own module, not signup, so skip past it — same reasoning as
  // the onboarding-tour suppression above.
  await page.getByRole("button", { name: "بعداً" }).click();

  // --- Lands on the Finance dashboard via the root smart-redirect ---
  await page.waitForURL("**/fa/finance");
  await expect(page.getByRole("heading", { name: "داشبورد مالی" })).toBeVisible();
  await page.screenshot({ path: "screenshots/01-dashboard-empty.png", fullPage: true });

  // --- Wallets: create one ---
  await page.getByRole("link", { name: "کیف‌پول‌ها" }).click();
  await page.waitForURL("**/fa/finance/wallets");
  await page.getByRole("button", { name: "کیف‌پول جدید" }).click();
  await page.getByLabel("نام").fill("کیف نقدی");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("کیف نقدی")).toBeVisible();
  await page.screenshot({ path: "screenshots/02-wallets.png", fullPage: true });

  // --- Categories: create an EXPENSE and INCOME category ---
  await page.getByRole("link", { name: "دسته‌بندی‌ها" }).click();
  await page.waitForURL("**/fa/finance/categories");
  await page.getByRole("button", { name: "دسته‌بندی جدید" }).click();
  await page.getByLabel("نام").fill("خوراک");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("خوراک")).toBeVisible();

  await page.getByRole("button", { name: "دسته‌بندی جدید" }).click();
  await page.getByLabel("نام").fill("حقوق");
  // type Select defaults to Expense — switch to Income for this one
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "درآمد" }).click();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("حقوق")).toBeVisible();
  await page.screenshot({ path: "screenshots/03-categories.png", fullPage: true });

  // --- Transactions: create an expense transaction ---
  await page.getByRole("link", { name: "تراکنش‌ها" }).click();
  await page.waitForURL("**/fa/finance/transactions");
  await page.getByRole("button", { name: "تراکنش جدید" }).click();
  // Expense is the default type toggle; pick wallet + category, set amount
  await page.locator('button[role="combobox"]').first().click();
  await page.getByRole("option", { name: "کیف نقدی" }).click();
  await page.locator('button[role="combobox"]').nth(1).click();
  await page.getByRole("option", { name: "خوراک" }).click();
  await page.getByLabel("مبلغ (تومان)").fill("150000");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(/۱۵۰,۰۰۰/)).toBeVisible();
  await page.screenshot({ path: "screenshots/04-transactions.png", fullPage: true });

  // --- Dashboard: confirm the transaction is reflected ---
  await page.getByRole("link", { name: "داشبورد" }).click();
  await page.waitForURL("**/fa/finance");
  await expect(page.getByText(/۱۵۰,۰۰۰/).first()).toBeVisible();
  await page.screenshot({ path: "screenshots/05-dashboard-with-data.png", fullPage: true });

  // --- Budgets: create one for the expense category ---
  await page.getByRole("link", { name: "بودجه‌ها" }).click();
  await page.waitForURL("**/fa/finance/budgets");
  await page.getByRole("button", { name: "بودجه جدید" }).click();
  await page.getByLabel("سقف بودجه (تومان)").fill("500000");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("خوراک")).toBeVisible();
  await page.screenshot({ path: "screenshots/06-budgets.png", fullPage: true });
});
