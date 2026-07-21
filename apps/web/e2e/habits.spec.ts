import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Same recipe as tasks.spec.ts: real browser, real dev server, real
// dockerized Postgres. Login -> create a DAILY habit -> mark it done today
// (streak becomes 1) -> create a WEEKLY habit with specific weekdays ->
// edit a habit's name -> open its monthly calendar and toggle a day ->
// delete a habit. One long happy-path flow, not one-test-per-page, for the
// same reason every other module's e2e spec is: the value is proving the
// list/dialog/streak/month-grid pieces compose against the real API, not
// just that each renders in isolation.
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

test("full Habits vertical slice: login -> create -> check in -> streak -> weekly habit -> edit -> month grid -> delete", async ({
  page,
}) => {
  const phone = freshPhone();

  // --- Login ---
  await page.addInitScript(() => window.localStorage.setItem("lifeos:onboarding-tour-seen", "1"));
  await page.goto("/fa/login");
  await page.getByLabel("شماره موبایل").fill(phone);
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await expect(page.getByLabel("کد تایید")).toBeVisible();
  const code = readOtpCodeFromLog(phone);
  await page.getByLabel("کد تایید").fill(code);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL("**/fa/finance");

  // --- Navigate to Habits ---
  await page.getByRole("link", { name: "عادت‌ها" }).click();
  await page.waitForURL("**/fa/habits");

  // --- Create a DAILY habit ---
  await page.getByRole("button", { name: "عادت جدید" }).click();
  await page.getByLabel("نام").fill("نوشیدن آب");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("نوشیدن آب")).toBeVisible();
  // Streak starts at zero, not yet checked today.
  await expect(page.getByText("۰ روز متوالی")).toBeVisible();
  await page.screenshot({ path: "screenshots/habits-01-created.png", fullPage: true });

  // --- Mark it done today: streak becomes 1, button label flips ---
  const habitRow = page.locator("div.rounded-md.border", { hasText: "نوشیدن آب" });
  await habitRow.getByRole("button", { name: "ثبت امروز" }).click();
  await expect(habitRow.getByRole("button", { name: "امروز انجام شد" })).toBeVisible();
  await expect(page.getByText("۱ روز متوالی")).toBeVisible();
  await page.screenshot({ path: "screenshots/habits-02-checked-in.png", fullPage: true });

  // --- Create a WEEKLY habit with specific weekdays ---
  await page.getByRole("button", { name: "عادت جدید" }).click();
  await page.getByLabel("نام").fill("ورزش");
  await page.getByLabel("بازه").click();
  await page.getByRole("option", { name: "هفتگی" }).click();
  await page.getByText("شنبه", { exact: true }).click();
  await page.getByText("دوشنبه", { exact: true }).click();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("ورزش")).toBeVisible();
  await page.screenshot({ path: "screenshots/habits-03-weekly-created.png", fullPage: true });

  // --- Edit the weekly habit's name ---
  const weeklyRow = page.locator("div.rounded-md.border", { hasText: "ورزش" });
  await weeklyRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "ویرایش" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("نام").fill("ورزش صبحگاهی");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("ورزش صبحگاهی")).toBeVisible();

  // --- Open the DAILY habit's monthly calendar and toggle a day ---
  await habitRow.getByRole("button", { name: "نمایش تقویم ماه" }).click();
  await expect(habitRow.getByText("در حال بارگذاری…")).toBeHidden();
  const dayOneButton = habitRow.getByRole("button", { name: "۱", exact: true });
  await dayOneButton.click();
  await expect(dayOneButton).toHaveClass(/bg-module-habits/);
  await page.screenshot({ path: "screenshots/habits-04-month-grid.png", fullPage: true });

  // --- Delete the weekly habit ---
  await weeklyRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "حذف" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "حذف", exact: true }).click();
  await expect(page.getByText("ورزش صبحگاهی")).toBeHidden();
  await page.screenshot({ path: "screenshots/habits-05-after-delete.png", fullPage: true });
});
