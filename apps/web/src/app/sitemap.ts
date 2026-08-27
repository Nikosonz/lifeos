import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/site";

/**
 * Every publicly indexable page, both locales, with reciprocal hreflang.
 *
 * PUBLIC means public. The list is deliberately short — the landing and the
 * privacy policy — because those are the only two routes a signed-out
 * visitor can render anything from. `/login` is excluded (a form with
 * nothing to index, and no reason to rank), and every `(app)` route is
 * behind auth and client-rendered, so a crawler would index an empty shell.
 *
 * `alternates.languages` here is the sitemap-level twin of the hreflang tags
 * the [locale] layout emits. Both are needed: Google reads whichever it
 * finds, and disagreement between them is worse than either alone, so they
 * are generated from the same absoluteUrl() helper rather than typed twice.
 */
const PUBLIC_PATHS = ["", "/privacy"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routing.locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: absoluteUrl(locale, path),
      lastModified,
      changeFrequency: "monthly" as const,
      // The landing is the entry point; the policy is a supporting page.
      priority: path === "" ? 1 : 0.5,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((alt) => [alt, absoluteUrl(alt, path)])),
      },
    })),
  );
}
