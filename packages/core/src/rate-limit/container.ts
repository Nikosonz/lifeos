import { getEnv } from "../config/env";
import { logger } from "../logging/logger";
import { InMemoryRateLimitStore } from "./adapters/in-memory-rate-limit-store";
import { RedisRateLimitStore } from "./adapters/redis-rate-limit-store";
import type { RateLimitStore } from "./ports/rate-limit-store";
import { RateLimitService } from "./services/rate-limit-service";

// Composition root for rate limiting. Unlike every other container in
// core, this one wires no repository — nothing here touches Postgres — so
// it imports no @lifeos/db at all.
//
// The store is resolved lazily and memoized rather than built at module
// scope, for the same reason getEnv() is lazy: this module is on the core
// barrel's export path, so it gets imported by `next build`, by every core
// unit test, and by apps/worker. Constructing a Redis client at import
// time would mean env validation (and, with a non-lazy client, a socket)
// on mere import. First actual limiter call is early enough.
let store: RateLimitStore | undefined;

function resolveStore(): RateLimitStore {
  if (!store) {
    const { REDIS_URL } = getEnv();
    store = REDIS_URL ? new RedisRateLimitStore(REDIS_URL) : new InMemoryRateLimitStore();
    logger.info(
      { event: "rate_limit.store_selected", store: REDIS_URL ? "redis" : "in-memory" },
      "rate limit store selected",
    );
  }
  return store;
}

// A thin forwarding wrapper rather than `new RateLimitService(resolveStore())`
// at module scope — that would resolve the store on import, defeating the
// laziness above. The service holds a RateLimitStore whose methods delegate
// to whichever concrete store the first call resolves.
const lazyStore: RateLimitStore = {
  increment: (key, windowMs) => resolveStore().increment(key, windowMs),
  claim: (key, ttlMs) => resolveStore().claim(key, ttlMs),
};

export const rateLimitService = new RateLimitService(lazyStore);
