// Single source of truth for where tokens live client-side. Matches the
// existing login page's original localStorage keys exactly ("accessToken"/
// "refreshToken") so nothing has to migrate mid-flight. See CLAUDE.md's
// Known Limitations for why localStorage (not an httpOnly cookie) is the
// deliberate choice here — the Bearer-token API must work identically for
// every client (web, Android, Telegram, MCP), and a cookie-based session
// would be a web-only special case introduced only if XSS surface grows.
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
