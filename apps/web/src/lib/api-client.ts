import { ErrorEnvelope } from "@lifeos/contracts";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./token-store";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly requestId: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// De-dupes concurrent refreshes: if 3 queries 401 at once, only one actual
// refresh call goes out and the other two await the same promise.
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { tokens: { accessToken: string; refreshToken: string } };
    setTokens(body.tokens.accessToken, body.tokens.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function redirectToLogin(): void {
  clearTokens();
  if (typeof window === "undefined") return;
  const locale = window.location.pathname.split("/")[1] === "en" ? "en" : "fa";
  window.location.assign(`/${locale}/login`);
}

interface ApiFetchOptions<T> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
  schema?: { parse: (data: unknown) => T };
  _isRetry?: boolean;
}

// The one place every Finance (and later, every other module's) client call
// goes through: attaches the Bearer token, retries exactly once through a
// refresh-token rotation on a 401, and otherwise surfaces the API's own
// error envelope as a typed ApiError. Response schemas are the same Zod
// schemas the server validates its own output with (packages/contracts) —
// parsing them again here is deliberate runtime safety, not redundant, and
// gives correct TS types for free (this project's Zod-everywhere
// convention).
export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions<T> = {},
): Promise<T> {
  const { method = "GET", body, query, idempotencyKey, schema } = opts;
  const headers: Record<string, string> = { "content-type": "application/json" };
  const accessToken = getAccessToken();
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  const queryString = query
    ? new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== undefined) as [string, string][],
      ).toString()
    : "";
  const url = queryString ? `${path}?${queryString}` : path;

  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401 && !opts._isRetry && path !== "/api/v1/auth/refresh") {
    refreshPromise ??= refreshTokens().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) return apiFetch(path, { ...opts, _isRetry: true });
    redirectToLogin();
    throw new ApiError("UNAUTHORIZED", "Session expired", 401, "client");
  }

  if (res.status === 204) return undefined as T;

  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = ErrorEnvelope.safeParse(json);
    if (parsed.success) {
      throw new ApiError(
        parsed.data.error.code,
        parsed.data.error.message,
        res.status,
        parsed.data.requestId,
        parsed.data.error.details,
      );
    }
    throw new ApiError("INTERNAL_ERROR", "Unexpected error", res.status, "unknown");
  }

  return schema ? schema.parse(json) : (json as T);
}
