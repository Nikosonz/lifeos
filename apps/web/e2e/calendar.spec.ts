import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Same recipe as finance.spec.ts/tasks.spec.ts: real browser, real dev
// server, real dockerized Postgres. Login -> create a one-off event ->
// create a recurring event (confirms the recurrence controls actually
// round-trip through the API) -> edit the one-off event -> delete the
// recurring one. One long happy-path flow, not one-test-per-page, for the
// same reason those other specs are: the value is proving the create/edit/
// delete cycle actually composes against the real agenda-merge endpoint,
// not just that the dialog renders.
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

// datetime-local values are local-time strings with no timezone component —
// "today, N hours from now" always lands within whatever Jalali month the
// Agenda page currently defaults to, since "now" is always inside it.
function datetimeLocal(hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test("full Calendar vertical slice: login -> create event -> recurring event -> edit -> delete", async ({
  page,
}) => {
  const phone = freshPhone();

  // --- Login (same flow as finance.spec.ts/tasks.spec.ts) ---
  // Pre-seed the onboarding tour's "seen" flag — see finance.spec.ts's
  // identical line for why.
  await page.addInitScript(() => window.localStorage.setItem("lifeos:onboarding-tour-seen", "1"));
  await page.goto("/fa/login");
  // Email is the default channel — the phone path is opt-in now. See
  // src/app/[locale]/login/page.tsx.
  await page.getByRole("button", { name: "شماره موبایل", exact: true }).click();
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

  // --- Navigate to Calendar ---
  await page.getByRole("link", { name: "تقویم" }).click();
  await page.waitForURL("**/fa/calendar");
  await expect(page.getByRole("heading", { name: "تقویم" })).toBeVisible();
  await page.screenshot({ path: "screenshots/calendar-01-empty.png", fullPage: true });

  // --- Create a one-off event ---
  await page.getByRole("button", { name: "رویداد جدید" }).click();
  await page.getByLabel("عنوان").fill("جلسه تیم");
  await page.getByLabel("شروع").fill(datetimeLocal(1));
  await page.getByLabel("پایان").fill(datetimeLocal(2));
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("جلسه تیم")).toBeVisible();
  await page.screenshot({ path: "screenshots/calendar-02-event-created.png", fullPage: true });

  // --- Create a recurring weekly event ---
  await page.getByRole("button", { name: "رویداد جدید" }).click();
  await page.getByLabel("عنوان").fill("یادآوری هفتگی");
  await page.getByLabel("شروع").fill(datetimeLocal(3));
  await page.getByLabel("پایان").fill(datetimeLocal(4));
  await page.getByLabel("تکرار").click();
  await page.getByRole("option", { name: "هفتگی" }).click();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  // A weekly recurring event created early in the Jalali month renders one
  // row per occurrence still inside the current (month-scoped) agenda
  // window — .first() is deliberate, not "should be unique like the
  // one-off event above.
  await expect(page.getByText("یادآوری هفتگی").first()).toBeVisible();
  await expect(page.getByText("تکرارشونده").first()).toBeVisible();
  await page.screenshot({ path: "screenshots/calendar-03-recurring.png", fullPage: true });

  // --- Edit the one-off event ---
  await page.locator("div.rounded-md.border", { hasText: "جلسه تیم" }).getByRole("button").click();
  await page.getByRole("menuitem", { name: "ویرایش" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // EventFormDialog's fields are wrapped in a disabled <fieldset> while its
  // async GET is in flight (see event-form-dialog.tsx), so .fill() below
  // auto-waits past the loading window on its own — no explicit wait needed
  // here to avoid racing the fetch.
  await page.getByLabel("عنوان").fill("جلسه تیم (به‌روزشده)");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("جلسه تیم (به‌روزشده)")).toBeVisible();
  await page.screenshot({ path: "screenshots/calendar-04-edited.png", fullPage: true });

  // --- Delete the recurring event ---
  // Same multi-occurrence caveat as creation above: delete via whichever
  // occurrence row renders first, which deletes the whole series (there's
  // one underlying CalendarEvent, not one per rendered occurrence).
  await page
    .locator("div.rounded-md.border", { hasText: "یادآوری هفتگی" })
    .first()
    .getByRole("button")
    .click();
  await page.getByRole("menuitem", { name: "حذف" }).click();
  await page.getByRole("button", { name: "حذف" }).click();
  // .first() here isn't "pick one of many" (there's nothing left to pick
  // after deletion) — it's what avoids toBeHidden() hard-failing on a
  // strict-mode violation during the brief window before the invalidated
  // query refetches and the remaining 3 occurrence rows unmount. A bare
  // getByText() throws immediately on any multi-match poll instead of
  // waiting for it to resolve to zero.
  await expect(page.getByText("یادآوری هفتگی").first()).toBeHidden();
  await page.screenshot({ path: "screenshots/calendar-05-after-delete.png", fullPage: true });
});
