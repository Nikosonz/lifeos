import { z } from "zod";

// E.164-ish: optional leading +, 8-15 digits total, first digit non-zero.
export const PhoneNumber = z.string().regex(/^\+?[1-9]\d{7,14}$/, "Invalid phone number");

export const RequestOtpInput = z.object({ phone: PhoneNumber });
export type RequestOtpInput = z.infer<typeof RequestOtpInput>;

export const VerifyOtpInput = z.object({
  phone: PhoneNumber,
  code: z.string().length(6),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpInput>;

export const RefreshInput = z.object({ refreshToken: z.string().min(1) });
export type RefreshInput = z.infer<typeof RefreshInput>;

export const AuthTokensResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string().datetime(),
});
export type AuthTokensResponse = z.infer<typeof AuthTokensResponse>;

export const UserResponse = z.object({
  id: z.uuid(),
  phone: z.string(),
  createdAt: z.string().datetime(),
});
export type UserResponse = z.infer<typeof UserResponse>;

export const SessionSummaryResponse = z.object({
  id: z.uuid(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
});
export type SessionSummaryResponse = z.infer<typeof SessionSummaryResponse>;
