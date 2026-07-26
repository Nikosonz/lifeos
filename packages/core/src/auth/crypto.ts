import { createHash, randomBytes, randomInt } from "node:crypto";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// 6-digit numeric OTP, cryptographically random (not Math.random).
//
// Dev-only escape hatch: when DEV_OTP_CODE is set, every OTP becomes that
// fixed value so you can sign in locally without fishing the code out of
// the server log. It's fail-closed — a hard throw if it's ever set with
// NODE_ENV=production, since a fixed OTP is a total auth bypass. Only your
// local (gitignored) apps/web/.env sets it; CI and production never do, so
// they keep the random generator below.
export function generateOtpCode(): string {
  const devCode = process.env.DEV_OTP_CODE;
  if (devCode) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DEV_OTP_CODE must never be set in production — it disables OTP security.");
    }
    if (!/^\d{6}$/.test(devCode)) {
      throw new Error("DEV_OTP_CODE must be exactly 6 digits.");
    }
    return devCode;
  }
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
