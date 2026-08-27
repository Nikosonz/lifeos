// The public origin, in one place — same one-constant shape as lib/brand.ts.
//
// Hardcoded rather than read from the environment on purpose. It is not a
// secret, it does not vary per deployment (there is exactly one public
// origin), and metadataBase must resolve at build time in a statically
// prerendered layout — an unset NEXT_PUBLIC_* would silently produce
// relative og:image URLs, which crawlers and Telegram's link preview both
// reject. A wrong constant fails loudly in review; a missing env var fails
// invisibly in production.
export const SITE_URL = "https://maaleto.ir";

// Locale-qualified absolute URL, e.g. absoluteUrl("fa", "/privacy").
export function absoluteUrl(locale: string, path = ""): string {
  return `${SITE_URL}/${locale}${path}`;
}

// Where a privacy or account-deletion request goes. Matches the address
// already published in the privacy policy (messages/*.json → Privacy).
export const CONTACT_EMAIL = "privacy@maaleto.ir";
