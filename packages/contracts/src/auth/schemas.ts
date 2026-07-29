import { z } from "zod";

// E.164-ish: optional leading +, 8-15 digits total, first digit non-zero.
export const PhoneNumber = z.string().regex(/^\+?[1-9]\d{7,14}$/, "Invalid phone number");
export const EmailAddress = z.email();

// Exactly one of phone/email — login is by a single identifier per
// request, never both at once. Login-by-phone and login-by-email are
// currently separate accounts with no linking flow (see CLAUDE.md's Auth
// Module section) — this schema only picks which channel a given request
// uses, it doesn't imply the two are related.
function exactlyOneIdentifier(
  data: { phone?: string | undefined; email?: string | undefined },
  ctx: z.RefinementCtx,
) {
  const provided = [data.phone, data.email].filter((v) => v !== undefined).length;
  if (provided !== 1) {
    ctx.addIssue({
      code: "custom",
      message: "Provide exactly one of phone or email",
      path: ["phone"],
    });
  }
}

export const RequestOtpInput = z
  .object({
    phone: PhoneNumber.optional(),
    email: EmailAddress.optional(),
  })
  .superRefine(exactlyOneIdentifier);
export type RequestOtpInput = z.infer<typeof RequestOtpInput>;

export const VerifyOtpInput = z
  .object({
    phone: PhoneNumber.optional(),
    email: EmailAddress.optional(),
    code: z.string().length(6),
  })
  .superRefine(exactlyOneIdentifier);
export type VerifyOtpInput = z.infer<typeof VerifyOtpInput>;

export const RefreshInput = z.object({ refreshToken: z.string().min(1) });
export type RefreshInput = z.infer<typeof RefreshInput>;

export const AuthTokensResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string().datetime(),
});
export type AuthTokensResponse = z.infer<typeof AuthTokensResponse>;

// A display name. Trimmed and length-bounded, but deliberately not
// pattern-restricted: Persian, Latin, and mixed scripts are all normal
// here, and any character allowlist would reject someone's actual name.
export const DisplayName = z.string().trim().min(1, "Name cannot be empty").max(80);

// phone/email are both nullable, never both null in practice (every account
// has at least one identifier — enforced in AuthService, not expressible as
// a DB constraint) — see the schema.prisma User model's comment for why.
// `name` is nullable for a different reason: it's genuinely optional, since
// an account is created by OTP verification before any name is asked for
// and the user may skip the step. Clients must render a fallback.
export const UserResponse = z.object({
  id: z.uuid(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type UserResponse = z.infer<typeof UserResponse>;

// Lets a client tell registration from login, which the API previously
// could not express at all — verify-otp find-or-creates silently, so every
// login looked identical to a first-ever signup. This is what gates the
// name/consent step to genuinely new accounts instead of re-prompting
// returning users. See ADR-0018.
export const VerifyOtpResponse = z.object({
  user: UserResponse,
  tokens: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.string().datetime(),
  }),
  isNewUser: z.boolean(),
});
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponse>;

export const CalendarPreference = z.enum(["JALALI", "GREGORIAN"]);
export type CalendarPreference = z.infer<typeof CalendarPreference>;

// /me's response, once a second method (PATCH) needed the same shape as
// the existing GET — includes the display-preference columns the Calendar
// module added to User (timezone/calendarPreference are stored now but not
// yet threaded into any date-boundary math — see the Calendar module docs).
export const MeResponse = UserResponse.extend({
  timezone: z.string(),
  calendarPreference: CalendarPreference,
});
export type MeResponse = z.infer<typeof MeResponse>;

// `name` is `.nullable().optional()` — the same deliberate distinction
// Tasks' `description` already established (see CLAUDE.md's Known
// Limitations on CalendarEventUpdateInput lacking it): omitting the key
// means "leave unchanged", while an explicit `null` means "clear it". A
// user who set a name must be able to remove it again, which a plain
// `.optional()` could not express.
export const UpdateProfileInput = z.object({
  name: DisplayName.nullable().optional(),
  timezone: z.string().min(1).optional(),
  calendarPreference: CalendarPreference.optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;

export const SessionSummaryResponse = z.object({
  id: z.uuid(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
});
export type SessionSummaryResponse = z.infer<typeof SessionSummaryResponse>;

// GET /api/v1/auth/sessions has always returned this envelope; it only
// gained a schema when the web device-management UI arrived and needed
// apiFetch to .parse() it (mobile hand-parses the same shape in its own
// repository). Not a wire change.
export const SessionListResponse = z.object({
  sessions: z.array(SessionSummaryResponse),
});
export type SessionListResponse = z.infer<typeof SessionListResponse>;

// DELETE /api/v1/me is irreversible and cascades across every table the
// account owns, so it requires an explicit body rather than being a bare
// verb on a URL. `z.literal(true)` — not `z.boolean()` — because the point
// is to make the destructive call impossible to issue by accident: an empty
// body, `{}`, or `{ confirm: false }` all fail validation and return a 400
// instead of deleting an account.
//
// This is a guard against malformed or replayed requests, not against a
// stolen token — a caller holding a valid access token can always send
// `{ confirm: true }`. Re-authentication for destructive actions is a
// separate, larger change (it needs an OTP round trip on both clients).
export const DeleteAccountInput = z.object({
  confirm: z.literal(true),
});
export type DeleteAccountInput = z.infer<typeof DeleteAccountInput>;
