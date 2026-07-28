import type { RateLimitStore } from "../ports/rate-limit-store";

// The MockSmsProvider of rate limiting: what you get when REDIS_URL is
// unset (a bare `npm run dev` with no docker, CI's unit-test run, and
// every core test that exercises a limited service).
//
// Correct for a single process and genuinely atomic there — JS runs this
// to completion between awaits, which is exactly the guarantee the Lua
// scripts buy on the Redis side. It is NOT correct across processes, which
// is precisely the distributed-safety gap CLAUDE.md documents; that's why
// production selects the Redis adapter and why this one is never the
// answer for a multi-instance deploy.
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, { count: number; expiresAt: number }>();

  // Expiry is checked lazily on read rather than swept on a timer: a
  // setInterval here would keep the Node process alive (and would need
  // unref()-ing in tests), for no benefit at this scale.
  private live(key: string, now: number) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  async increment(key: string, windowMs: number) {
    const now = Date.now();
    const existing = this.live(key, now);
    if (!existing) {
      this.entries.set(key, { count: 1, expiresAt: now + windowMs });
      return { count: 1, resetAfterMs: windowMs };
    }
    existing.count += 1;
    return { count: existing.count, resetAfterMs: existing.expiresAt - now };
  }

  async claim(key: string, ttlMs: number) {
    const now = Date.now();
    const existing = this.live(key, now);
    if (existing) return { claimed: false, retryAfterMs: existing.expiresAt - now };
    this.entries.set(key, { count: 1, expiresAt: now + ttlMs });
    return { claimed: true, retryAfterMs: 0 };
  }
}
