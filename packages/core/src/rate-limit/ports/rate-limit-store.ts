// The second genuine port in this codebase (after SmsProvider): the
// storage backing a rate limiter really does differ between environments —
// Redis in production/local-docker, an in-process map in unit tests and in
// a bare `npm run dev` with no Redis running. Everything *above* this
// interface (what the limits are, when to reject, what Retry-After to
// report) is business logic and lives in RateLimitService, not here.
//
// Both operations must be atomic in the backing store. That atomicity is
// the entire point of this port existing rather than the services doing
// their own read-then-write — see OtpService's old resend cooldown, which
// was a Postgres read-then-write two concurrent requests could both pass.
export interface RateLimitStore {
  /**
   * Fixed-window counter. Atomically increments the counter for `key`,
   * starting a fresh `windowMs` window on the first hit only (a later hit
   * inside the same window must not extend it, or a steady stream of
   * requests would hold the window open forever).
   *
   * Returns the post-increment count and how long is left in this window.
   */
  increment(key: string, windowMs: number): Promise<{ count: number; resetAfterMs: number }>;

  /**
   * Single-slot cooldown. Atomically takes `key` for `ttlMs` if and only if
   * nobody currently holds it — the "only one of these may run per window"
   * primitive, as opposed to increment()'s "at most N per window".
   *
   * Returns whether the caller now holds it, and (when it didn't) how long
   * until the current holder's slot frees up.
   */
  claim(key: string, ttlMs: number): Promise<{ claimed: boolean; retryAfterMs: number }>;
}
