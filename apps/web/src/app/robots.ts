import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * There was no robots.txt before 2026-08-27 — a bare 404 at /robots.txt.
 *
 * `/api/` and the authenticated app segments are disallowed. That is
 * housekeeping rather than protection: `/api/v1` is Bearer-authenticated
 * and every app route is client-rendered behind AuthGate, so a crawler
 * gets nothing from either. Excluding them keeps crawl budget on the two
 * pages that are actually public and stops empty auth shells competing
 * with the landing in the index.
 *
 * This is a route, not a static file, so it needs no public/ directory —
 * which matters here because the standalone output does not copy one (see
 * apps/web/Dockerfile).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/fa/finance",
        "/en/finance",
        "/fa/tasks",
        "/en/tasks",
        "/fa/calendar",
        "/en/calendar",
        "/fa/habits",
        "/en/habits",
        "/fa/reports",
        "/en/reports",
        "/fa/notifications",
        "/en/notifications",
        "/fa/settings",
        "/en/settings",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
