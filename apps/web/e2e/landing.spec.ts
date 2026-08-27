import { test, expect } from "@playwright/test";

/**
 * The landing is the only page an anonymous visitor sees, and until
 * 2026-08-27 it shipped with an EMPTY <title> and a CTA pointing at a
 * sign-in channel that returns 400 in production. Both of those were
 * invisible to every existing test, because every existing test starts by
 * logging in.
 *
 * These assertions are deliberately about the things that were broken and
 * the things a redesign would silently drop — the head, the CTA target, the
 * direction, one h1 — not about copy, which changes on purpose.
 */

const LOCALES = [
  { locale: "fa", dir: "rtl", brand: "مال تو" },
  { locale: "en", dir: "ltr", brand: "maaleto" },
] as const;

for (const { locale, dir, brand } of LOCALES) {
  test.describe(`/${locale}`, () => {
    test("renders with a real document head", async ({ page }) => {
      await page.goto(`/${locale}`);

      await expect(page.locator("html")).toHaveAttribute("dir", dir);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);

      // The exact regression: <title> was empty and there were no og:* tags.
      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);

      await expect(page.locator('meta[name="description"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        new RegExp(`og-${locale}\\.png`),
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://maaleto.ir/${locale}`,
      );
      // Both locales plus x-default, reciprocal in each direction.
      await expect(page.locator('link[rel="alternate"][hreflang="fa"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    });

    test("has exactly one h1 and the brand wordmark", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("link", { name: brand }).first()).toBeVisible();
    });

    test("the primary CTA goes to login, and never offers phone sign-up", async ({ page }) => {
      await page.goto(`/${locale}`);

      // Scoped to <main>: the header also links /login, as "Sign in", and
      // that one is first in the DOM. The CTAs are the two inside the page
      // body — the hero and the closing block.
      const ctas = page.locator(`main a[href="/${locale}/login"]`);
      expect(await ctas.count()).toBe(2);

      const ctaText = (await ctas.first().textContent()) ?? "";
      if (locale === "fa") {
        expect(ctaText).toContain("ایمیل");
        expect(ctaText).not.toContain("موبایل");
      } else {
        expect(ctaText.toLowerCase()).toContain("email");
        expect(ctaText.toLowerCase()).not.toContain("phone");
      }

      await ctas.first().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
    });

    test("the FAQ opens without JavaScript state", async ({ page }) => {
      await page.goto(`/${locale}`);
      // <details>/<summary>: no hydration involved, which is the point.
      const first = page.locator("#faq details").first();
      await expect(first).not.toHaveAttribute("open", /.*/);
      await first.locator("summary").click();
      await expect(first).toHaveAttribute("open", /.*/);
    });

    test("does not scroll horizontally on a small phone", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto(`/${locale}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // 1px of subpixel rounding is tolerable; a broken layout is not.
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test("every product demo is labelled a sample", async ({ page }) => {
      await page.goto(`/${locale}`);
      // The demos render account chrome with invented figures. If the badge
      // ever disappears, the page starts implying it is showing real data.
      const frames = page.getByRole("img", { name: locale === "fa" ? /نمونه/ : /sample/i });
      expect(await frames.count()).toBeGreaterThanOrEqual(3);
    });
  });
}

test("the locale switch reaches the other locale", async ({ page }) => {
  await page.goto("/fa");
  await page.getByRole("link", { name: "English" }).first().click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("robots.txt and sitemap.xml exist", async ({ request }) => {
  // Both were 404s before this change.
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap: https://maaleto.ir/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("https://maaleto.ir/fa");
  expect(xml).toContain("https://maaleto.ir/en");
  expect(xml).toContain("https://maaleto.ir/fa/privacy");
});

test("the Open Graph images are actually served", async ({ request }) => {
  // These live in public/, which the standalone output does NOT copy by
  // default — apps/web/Dockerfile has an explicit COPY for exactly this.
  // Passing here proves dev serves them; the container check is separate.
  for (const locale of ["fa", "en"]) {
    const res = await request.get(`/og-${locale}.png`);
    expect(res.status(), `/og-${locale}.png`).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});
