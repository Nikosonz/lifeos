import { MeResponse, SessionListResponse, type UpdateProfileInput } from "@lifeos/contracts";
import { apiFetch } from "./api-client";

// Profile + device management, the two things the Settings page composes.
// `PATCH /api/v1/me` and the sessions routes all predate this file; only
// the web UI that calls them is new (mobile has had device management
// since its first release — see CLAUDE.md's Mobile App section).
export const settingsApi = {
  me: () => apiFetch("/api/v1/me", { schema: MeResponse }),
  updateProfile: (body: UpdateProfileInput) =>
    apiFetch("/api/v1/me", { method: "PATCH", body, schema: MeResponse }),
  listSessions: () => apiFetch("/api/v1/auth/sessions", { schema: SessionListResponse }),
  revokeSession: (id: string) => apiFetch(`/api/v1/auth/sessions/${id}`, { method: "DELETE" }),
};
