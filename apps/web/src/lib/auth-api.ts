import { apiFetch } from "./api-client";

// Best-effort: the app shell's logout button calls this then clears local
// tokens and redirects regardless of whether the call itself succeeds — a
// user who's already offline should still be able to "log out" locally.
// No body needed: POST /api/v1/auth/logout revokes the session identified
// by the Bearer token itself (apiFetch attaches it automatically).
export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
  } catch {
    // Swallowed deliberately — see comment above.
  }
}
