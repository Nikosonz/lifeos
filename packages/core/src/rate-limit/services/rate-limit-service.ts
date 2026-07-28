import { RateLimitedError } from "../../errors/app-error";
import { logger } from "../../logging/logger";
import type { RateLimitStore } from "../ports/rate-limit-store";

export type RateLimitRule = {
  /** Maximum requests permitted per window. */
  limit: number;
  windowMs: number;
};

// Retry-After is expressed in whole seconds (RFC 9110 §10.2.3), and it must
// round *up*: reporting 0 (or a truncated 1 when 1.4s remain) invites an
// immediate retry that's still inside the window and gets rejected again.
function retryAfterSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/**
 * Per-IP limits are disabled on a dev box, keyed off the *existing*
 * DEV_OTP_CODE signal rather than a new flag of its own.
 *
 * Why this is needed: every automated test runs from one IP (localhost),
 * so `apps/web/e2e`'s six specs plus any manual curl verification blow
 * through `otpRequestPerIp` (10/hour) partway through a single suite run —
 * found the hard way, with four specs failing on a 429 that looked like a
 * regression in the feature under test. Any per-IP limit low enough to be
 * meaningful in production is too low for a repeatedly-run e2e suite, so
 * raising the number would not fix this.
 *
 * Why reuse DEV_OTP_CODE: it already means "this deployment has OTP
 * security disabled" and already hard-throws when NODE_ENV=production
 * (see auth/crypto.ts). A box in that state gains nothing from per-IP OTP
 * throttling, and a second independent bypass variable would be a second
 * way to accidentally disarm production. Per-identifier cooldowns are
 * unaffected — they are not IP-scoped and stay on even here.
 */
function perIpLimitsDisabled(): boolean {
  return process.env.DEV_OTP_CODE !== undefined && process.env.NODE_ENV !== "production";
}

/**
 * Owns every rate-limiting *decision* — the store only counts. Callers
 * name a bucket and a subject; this decides whether that's over the line
 * and what to tell the client.
 *
 * Keys are `rl:<bucket>:<subject>`, so buckets are independent by
 * construction (the same IP hitting request-otp and refresh consumes two
 * separate budgets) — the same scoping-by-namespace reasoning behind
 * OtpService hashing its codes under `channel:identifier:code`.
 */
export class RateLimitService {
  constructor(private readonly store: RateLimitStore) {}

  private key(bucket: string, subject: string) {
    return `rl:${bucket}:${subject}`;
  }

  /**
   * Fail **open**, deliberately. A rate limiter is a guard on a working
   * API, not a dependency of it — if Redis is unreachable, rejecting every
   * request would convert a limiter outage into a total outage, which is a
   * strictly worse failure than briefly not enforcing a limit. The error
   * is logged at warn with a stable `event` name so the degradation is
   * visible rather than silent.
   *
   * This is the right trade for *these* limits (abuse throttling). It
   * would be the wrong trade for a limiter guarding something with
   * irreversible cost per call; revisit per-bucket if that ever exists.
   */
  private async safely<T>(
    op: () => Promise<T>,
    fallback: T,
    context: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await op();
    } catch (err) {
      logger.warn(
        { event: "rate_limit.store_unavailable", err, ...context },
        "rate limit store unavailable — allowing request",
      );
      return fallback;
    }
  }

  /** Throws RateLimitedError once `subject` exceeds `rule` in this window. */
  async consume(bucket: string, subject: string, rule: RateLimitRule): Promise<void> {
    if (perIpLimitsDisabled()) {
      logger.debug(
        { event: "rate_limit.skipped_dev", bucket },
        "per-IP rate limiting disabled (DEV_OTP_CODE is set)",
      );
      return;
    }

    const result = await this.safely(
      () => this.store.increment(this.key(bucket, subject), rule.windowMs),
      // A count of 0 can never exceed a limit of >= 1, so the fallback is
      // "allowed" without needing a second code path to express it.
      { count: 0, resetAfterMs: 0 },
      { bucket },
    );

    if (result.count > rule.limit) {
      throw new RateLimitedError(
        "Too many requests — please slow down",
        retryAfterSeconds(result.resetAfterMs),
      );
    }
  }

  /**
   * Single-slot cooldown: succeeds for the first caller in `cooldownMs` and
   * throws for everyone else until it lapses. Unlike consume(), the caller
   * supplies the rejection message, because a cooldown is usually a
   * product-level rule with its own user-facing copy (the OTP resend
   * cooldown) rather than generic abuse throttling.
   *
   * Returns whether the slot was actually claimed, so a caller that wants
   * to degrade rather than reject on a store outage can tell the
   * difference — `false` means "not claimed and not rejected", i.e. the
   * store failed open and the caller owns what happens next.
   */
  async claimCooldown(
    bucket: string,
    subject: string,
    cooldownMs: number,
    message: string,
  ): Promise<boolean> {
    const result = await this.safely(
      () => this.store.claim(this.key(bucket, subject), cooldownMs),
      { claimed: false, retryAfterMs: -1 },
      { bucket },
    );

    // retryAfterMs === -1 is the fail-open sentinel from safely() above:
    // not claimed, but not a real rejection either.
    if (!result.claimed && result.retryAfterMs >= 0) {
      throw new RateLimitedError(message, retryAfterSeconds(result.retryAfterMs));
    }
    return result.claimed;
  }
}
