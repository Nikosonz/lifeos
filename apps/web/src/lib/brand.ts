// The product's display name, localized. fa (default) shows the Persian
// brand "مال تو" ("yours"); other locales use the romanized form "maaleto".
// Single source so the wordmark stays consistent across the landing, the app
// shell, and the login card.
export function brandName(locale: string): string {
  return locale === "fa" ? "مال تو" : "maaleto";
}
