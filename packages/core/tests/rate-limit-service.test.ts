import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryRateLimitStore } from "../src/rate-limit/adapters/in-memory-rate-limit-store";
import type { RateLimitStore } from "../src/rate-limit/ports/rate-limit-store";
import { RateLimitService } from "../src/rate-limit/services/rate-limit-service";
import { RateLimitedError } from "../src/errors/app-error";

function makeService(store: RateLimitStore = new InMemoryRateLimitStore()) {
  return new RateLimitService(store);
}

// A store that always throws — the "Redis is down" case, which has its own
// deliberate fail-open behavior worth pinning down (see RateLimitService).
const brokenStore: RateLimitStore = {
  async increment() {
    throw new Error("connection refused");
  },
  async claim() {
    throw new Error("connection refused");
  },
};

test("consume allows requests up to the limit", async () => {
  const service = makeService();
  const rule = { limit: 3, windowMs: 60_000 };

  for (let i = 0; i < 3; i++) {
    await service.consume("test", "1.2.3.4", rule);
  }
});

test("consume rejects the request past the limit", async () => {
  const service = makeService();
  const rule = { limit: 3, windowMs: 60_000 };

  for (let i = 0; i < 3; i++) await service.consume("test", "1.2.3.4", rule);

  await assert.rejects(() => service.consume("test", "1.2.3.4", rule), RateLimitedError);
});

test("a rejected request reports a positive whole-second Retry-After", async () => {
  const service = makeService();
  const rule = { limit: 1, windowMs: 60_000 };
  await service.consume("test", "1.2.3.4", rule);

  await assert.rejects(
    () => service.consume("test", "1.2.3.4", rule),
    (err: unknown) => {
      assert.ok(err instanceof RateLimitedError);
      // Must never be 0 — a client honouring Retry-After: 0 would retry
      // immediately, still inside the window, and be rejected again.
      assert.ok(err.retryAfterSeconds !== undefined && err.retryAfterSeconds >= 1);
      assert.ok(err.retryAfterSeconds <= 60);
      return true;
    },
  );
});

test("subjects are limited independently", async () => {
  const service = makeService();
  const rule = { limit: 1, windowMs: 60_000 };

  await service.consume("test", "1.1.1.1", rule);
  // A different IP must get its own budget, not inherit the first one's.
  await service.consume("test", "2.2.2.2", rule);
  await assert.rejects(() => service.consume("test", "1.1.1.1", rule), RateLimitedError);
});

test("buckets are limited independently for the same subject", async () => {
  const service = makeService();
  const rule = { limit: 1, windowMs: 60_000 };

  await service.consume("otp-request", "1.1.1.1", rule);
  // Same caller, different endpoint — must not share a budget.
  await service.consume("otp-verify", "1.1.1.1", rule);
  await assert.rejects(() => service.consume("otp-request", "1.1.1.1", rule), RateLimitedError);
});

test("the window expires, restoring the budget", async () => {
  const service = makeService();
  const rule = { limit: 1, windowMs: 20 };

  await service.consume("test", "1.2.3.4", rule);
  await assert.rejects(() => service.consume("test", "1.2.3.4", rule), RateLimitedError);

  await new Promise((resolve) => setTimeout(resolve, 30));
  await service.consume("test", "1.2.3.4", rule);
});

test("claimCooldown grants the slot to exactly one of many concurrent callers", async () => {
  const service = makeService();

  // The actual race the OTP resend cooldown had against Postgres: N
  // callers arriving together, all reading "no recent code", all passing.
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      service.claimCooldown("otp-resend", "SMS:+989120000001", 60_000, "wait"),
    ),
  );

  const granted = results.filter((r) => r.status === "fulfilled" && r.value === true);
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(granted.length, 1);
  assert.equal(rejected.length, 7);
  assert.ok(rejected.every((r) => r.reason instanceof RateLimitedError));
});

test("claimCooldown surfaces the caller's own message and a Retry-After", async () => {
  const service = makeService();
  await service.claimCooldown("otp-resend", "SMS:+989120000002", 60_000, "please wait");

  await assert.rejects(
    () => service.claimCooldown("otp-resend", "SMS:+989120000002", 60_000, "please wait"),
    (err: unknown) => {
      assert.ok(err instanceof RateLimitedError);
      assert.equal(err.message, "please wait");
      assert.ok(err.retryAfterSeconds !== undefined && err.retryAfterSeconds >= 1);
      return true;
    },
  );
});

test("consume fails open when the store is unavailable", async () => {
  const service = makeService(brokenStore);
  // A limiter outage must not become an API outage — the whole point of
  // the deliberate fail-open in RateLimitService.safely().
  await service.consume("test", "1.2.3.4", { limit: 1, windowMs: 60_000 });
  await service.consume("test", "1.2.3.4", { limit: 1, windowMs: 60_000 });
});

test("claimCooldown fails open without claiming when the store is unavailable", async () => {
  const service = makeService(brokenStore);

  // Neither throws (fail-open) nor reports a claim — false is what tells
  // OtpService to fall back to its Postgres timestamp check rather than
  // assume the cooldown was enforced.
  const claimed = await service.claimCooldown("otp-resend", "SMS:x", 60_000, "wait");
  assert.equal(claimed, false);
});
