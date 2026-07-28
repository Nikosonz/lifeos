import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Same recipe as finance.spec.ts/tasks.spec.ts/calendar.spec.ts. Unlike
// those, Notifications and Reports have no data of their own to create —
// both are pure compositions of other modules (a notification only exists
// because Finance's budget-exceeded trigger fired; a report row only
// exists because Finance/Tasks data does), so the only way to meaningfully
// test either is to drive the actual triggering flow through the real UI:
// wallet -> category -> a deliberately-small budget -> an over-limit
// transaction (fires the notification) -> a completed task (feeds the
// report's task counts) -> then verify both Notifications and Reports
// reflect it. This is the test that actually proves the cross-module
// composition works, not just that either page renders.
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

test("Notifications + Reports: budget-exceeded trigger and cross-module dashboard report", async ({
  page,
}) => {
  const phone = freshPhone();

  // --- Login ---
  // Pre-seed the onboarding tour's "seen" flag — see finance.spec.ts's
  // identical line for why.
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
  await page.waitForURL("**/fa/finance");

  // --- Wallet ---
  await page.getByRole("link", { name: "کیف‌پول‌ها" }).click();
  await page.waitForURL("**/fa/finance/wallets");
  await page.getByRole("button", { name: "کیف‌پول جدید" }).click();
  await page.getByLabel("نام").fill("کیف نقدی");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // --- Category (single EXPENSE category, so the Budget dialog's category
  // select has only one option to default to) ---
  await page.getByRole("link", { name: "دسته‌بندی‌ها" }).click();
  await page.waitForURL("**/fa/finance/categories");
  await page.getByRole("button", { name: "دسته‌بندی جدید" }).click();
  await page.getByLabel("نام").fill("خوراک");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // --- Budget: a deliberately small limit for the current month ---
  await page.getByRole("link", { name: "بودجه‌ها" }).click();
  await page.waitForURL("**/fa/finance/budgets");
  await page.getByRole("button", { name: "بودجه جدید" }).click();
  await page.getByLabel("سقف بودجه (تومان)").fill("10000");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // --- Transaction: well over the budget limit -> fires the
  // FINANCE_BUDGET_EXCEEDED notification synchronously (ADR-0009) ---
  await page.getByRole("link", { name: "تراکنش‌ها" }).click();
  await page.waitForURL("**/fa/finance/transactions");
  await page.getByRole("button", { name: "تراکنش جدید" }).click();
  await page.locator('button[role="combobox"]').first().click();
  await page.getByRole("option", { name: "کیف نقدی" }).click();
  await page.locator('button[role="combobox"]').nth(1).click();
  await page.getByRole("option", { name: "خوراک" }).click();
  await page.getByLabel("مبلغ (تومان)").fill("150000");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(/۱۵۰,۰۰۰/)).toBeVisible();

  // --- Task: create then complete it, so Reports' task counts are non-zero ---
  await page.getByRole("link", { name: "وظایف", exact: true }).click();
  await page.waitForURL("**/fa/tasks");
  await page.getByRole("button", { name: "وظیفه جدید" }).click();
  await page.getByLabel("عنوان").fill("تمرین کدنویسی");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .locator("div.rounded-md.border", { hasText: "تمرین کدنویسی" })
    .getByRole("button")
    .click();
  await page.getByRole("menuitem", { name: "ویرایش" }).click();
  await page.getByRole("dialog").getByLabel("وضعیت").click();
  await page.getByRole("option", { name: "انجام‌شده" }).click();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // --- Notifications: the budget-exceeded notification is there, unread ---
  await page.getByRole("link", { name: "اعلان‌ها" }).click();
  await page.waitForURL("**/fa/notifications");
  await expect(page.getByRole("heading", { name: "اعلان‌ها" })).toBeVisible();
  await expect(page.getByText("۱ خوانده‌نشده")).toBeVisible();
  await expect(page.getByText("بودجه دسته‌بندی تمام شد")).toBeVisible();
  await expect(page.getByText(/خوراک/)).toBeVisible();
  await page.screenshot({ path: "screenshots/notifications-01-unread.png", fullPage: true });

  // --- Mark all read: unread badge disappears ---
  await page.getByRole("button", { name: "علامت‌گذاری همه به‌عنوان خوانده‌شده" }).click();
  await expect(page.getByText("۱ خوانده‌نشده")).toBeHidden();
  await page.screenshot({ path: "screenshots/notifications-02-read.png", fullPage: true });

  // --- Reports: same month's data, composed from Finance + Tasks ---
  await page.getByRole("link", { name: "گزارش‌ها" }).click();
  await page.waitForURL("**/fa/reports");
  await expect(page.getByRole("heading", { name: "گزارش‌ها" })).toBeVisible();
  await expect(page.getByText(/۱۵۰,۰۰۰/).first()).toBeVisible();
  await expect(page.getByText("خوراک")).toBeVisible();
  await expect(page.getByText("۱", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "screenshots/reports-01-data.png", fullPage: true });
});
