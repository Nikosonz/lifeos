import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Same recipe as finance.spec.ts: real browser, real dev server, real
// dockerized Postgres. Login -> project -> label -> task (assigned to both)
// -> confirm the row reflects project/label/status/priority -> subtasks
// (add + toggle complete) -> status filter actually filters. One long
// happy-path flow, not one-test-per-page, for the same reason Finance's
// test is: the value is proving Task<->Project<->Label composition and
// that the status filter's query param actually round-trips through a
// real fetch, not just that each page renders in isolation.
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

test("full Tasks vertical slice: login -> project -> label -> task -> subtasks -> status filter", async ({
  page,
}) => {
  const phone = freshPhone();

  // --- Login (same flow as finance.spec.ts) ---
  await page.goto("/fa/login");
  await page.getByLabel("شماره موبایل").fill(phone);
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await expect(page.getByLabel("کد تایید")).toBeVisible();
  const code = readOtpCodeFromLog(phone);
  await page.getByLabel("کد تایید").fill(code);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL("**/fa/finance");

  // --- Project: create one ---
  await page.getByRole("link", { name: "پروژه‌ها" }).click();
  await page.waitForURL("**/fa/tasks/projects");
  await page.getByRole("button", { name: "پروژه جدید" }).click();
  await page.getByLabel("نام").fill("پروژه وب‌سایت");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("پروژه وب‌سایت")).toBeVisible();
  await page.screenshot({ path: "screenshots/tasks-01-projects.png", fullPage: true });

  // --- Label: create one ---
  await page.getByRole("link", { name: "برچسب‌ها" }).click();
  await page.waitForURL("**/fa/tasks/labels");
  await page.getByRole("button", { name: "برچسب جدید" }).click();
  await page.getByLabel("نام").fill("شخصی");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("شخصی")).toBeVisible();
  await page.screenshot({ path: "screenshots/tasks-02-labels.png", fullPage: true });

  // --- Task: create one, assigned to the project + label ---
  await page.getByRole("link", { name: "وظایف", exact: true }).click();
  await page.waitForURL("**/fa/tasks");
  await page.getByRole("button", { name: "وظیفه جدید" }).click();
  await page.getByLabel("عنوان").fill("طراحی صفحه اصلی");
  // Project select
  await page.getByLabel("پروژه").click();
  await page.getByRole("option", { name: "پروژه وب‌سایت" }).click();
  // Label toggle (rendered as a clickable badge, not a native checkbox)
  await page.getByText("شخصی", { exact: true }).click();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("طراحی صفحه اصلی")).toBeVisible();
  // Confirm project name and label chip both render on the row
  await expect(page.getByText("پروژه وب‌سایت")).toBeVisible();
  await expect(page.getByText("شخصی")).toBeVisible();
  await page.screenshot({ path: "screenshots/tasks-03-task-created.png", fullPage: true });

  // --- Subtasks: add one, mark it complete ---
  await page
    .locator("div.rounded-md.border", { hasText: "طراحی صفحه اصلی" })
    .getByRole("button")
    .click();
  await page.getByRole("menuitem", { name: "زیروظیفه‌ها" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByPlaceholder("زیروظیفه جدید").fill("انتخاب رنگ‌بندی");
  await page.getByRole("button", { name: "افزودن" }).click();
  await expect(page.getByText("انتخاب رنگ‌بندی")).toBeVisible();
  await page.getByRole("checkbox").click();
  await expect(page.getByText("انتخاب رنگ‌بندی")).toHaveClass(/line-through/);
  await page.screenshot({ path: "screenshots/tasks-04-subtasks.png", fullPage: true });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // --- Status filter: switching to "Done" hides the (still To-Do) task ---
  await page.getByLabel("وضعیت").click();
  await page.getByRole("option", { name: "انجام‌شده" }).click();
  await expect(page.getByText("طراحی صفحه اصلی")).toBeHidden();
  await page.getByLabel("وضعیت").click();
  await page.getByRole("option", { name: "همه" }).click();
  await expect(page.getByText("طراحی صفحه اصلی")).toBeVisible();
  await page.screenshot({ path: "screenshots/tasks-05-filtered-back.png", fullPage: true });
});
