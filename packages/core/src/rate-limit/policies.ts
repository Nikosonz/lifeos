import type { RateLimitRule } from "./services/rate-limit-service";

// What the limits actually are lives here, in core, not at the call sites
// in apps/web — same Rule-2 reasoning as every other business constant:
// a future client (Telegram, MCP) hitting the same endpoints must get the
// same limits without re-deciding them, and changing a number should be a
// one-line edit in one file.
//
// The numbers are deliberately loose. These exist to stop scripted abuse
// and runaway retry loops, not to police normal use — a limit a real user
// can hit by using the app briskly is a bug, and the cost of being too
// generous here is far lower than the cost of locking someone out of
// their own account.
export const RATE_LIMITS = {
  /**
   * Per-IP cap on OTP *sends*. This is the axis CLAUDE.md's Known
   * Limitations calls out as missing: the per-identifier cooldown stops
   * hammering one number, but nothing stopped one client from walking
   * through many different numbers — which, once a real SMS provider is
   * wired in, is somebody else's phone bill.
   *
   * 10/hour is far above any legitimate use (a real person signs in for
   * one, maybe two identifiers) and far below a useful bombing rate.
   */
  otpRequestPerIp: { limit: 10, windowMs: 60 * 60 * 1000 },

  /**
   * Per-IP cap on verify attempts. OtpService already locks a single code
   * after 5 wrong guesses, but that limit is per-code: an attacker could
   * request a fresh code and get 5 more guesses, indefinitely. This caps
   * the total guess rate from one source regardless of how many codes it
   * cycles through.
   */
  otpVerifyPerIp: { limit: 20, windowMs: 15 * 60 * 1000 },

  /**
   * Per-IP cap on refresh-token rotation. Refresh is unauthenticated in
   * the Bearer sense (the opaque token *is* the credential), so it's the
   * one other endpoint worth guarding against brute force. Generous
   * because a legitimate client refreshes roughly every 15 minutes, and
   * several devices can legitimately share one IP.
   */
  refreshPerIp: { limit: 60, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

/** Resend cooldown for a single identifier — one code per minute, per (channel, identifier). */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
