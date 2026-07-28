import Redis from "ioredis";
import type { RateLimitStore } from "../ports/rate-limit-store";

// Both operations are Lua rather than MULTI/pipelines. Two reasons, and
// the first is the load-bearing one:
//
// 1. Atomicity with a *conditional* step. increment() must only set the
//    TTL when it created the key, and claim() must read the remaining TTL
//    only when the SET failed. MULTI can't branch — it queues commands
//    blindly and runs them all — so expressing "set the expiry only if
//    this is the first hit" needs either a WATCH/retry loop or a script.
//    EXPIRE's own NX flag could cover increment(), but that's Redis 7.0+
//    only and would silently no-op the TTL against an older server,
//    turning every limiter into a permanent lockout on the first burst.
//    A script has no such version floor and fails loudly if it fails.
// 2. One round trip each, so a limiter check adds one RTT to a request
//    rather than two or three.
const INCREMENT_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('PTTL', KEYS[1]) }
`;

const CLAIM_LUA = `
if redis.call('SET', KEYS[1], '1', 'PX', ARGV[1], 'NX') then
  return { 1, 0 }
end
return { 0, redis.call('PTTL', KEYS[1]) }
`;

// PTTL returns -1 (key exists, no expiry) or -2 (key is gone) rather than
// a duration. Neither should happen — every key this store writes is
// created with a TTL in the same atomic script — but a negative value
// must never reach Retry-After, so clamp instead of trusting it.
function msOrZero(pttl: number): number {
  return pttl > 0 ? pttl : 0;
}

function parseLuaPair(raw: unknown): [number, number] {
  // ioredis types eval()'s result as `unknown` (a script can return any
  // RESP type), so narrow rather than cast — a malformed reply should be
  // a clear error here, not an `undefined` propagating into arithmetic.
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error(`Unexpected Redis script reply: ${JSON.stringify(raw)}`);
  }
  return [Number(raw[0]), Number(raw[1])];
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, {
      // Connect on first command, not on construction — the composition
      // root is imported by `next build` and by every unit test that
      // touches the core barrel, none of which should open a socket.
      lazyConnect: true,
      // Must stay true (the default), and it is load-bearing *because* of
      // lazyConnect above: with lazyConnect there is no connection when
      // the first command is issued, so the offline queue is what holds
      // that command while the socket opens. Setting it false was a real
      // bug — every single call failed with "Stream isn't writeable and
      // enableOfflineQueue options is false" and fell through
      // RateLimitService's fail-open path, so the limiter silently never
      // enforced anything. Caught only by driving real requests against a
      // real Redis; nothing in the type system or the unit tests (which
      // use the in-memory store) can see it.
      enableOfflineQueue: true,
      // Bounds how long a queued command can wait: once reconnect attempts
      // exceed this, ioredis flushes the offline queue with an error
      // rather than holding requests open. A limiter check that hangs is
      // worse than one that errors, since RateLimitService can only fail
      // open if the call actually returns.
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      // Keeps reconnecting (with a capped backoff) rather than giving up
      // permanently — returning null here would leave a long-lived server
      // with a dead client that never recovers when Redis comes back.
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    // Without a listener, ioredis emits 'error' on an unreachable server as
    // an unhandled 'error' event, which crashes the Node process. The
    // per-command rejection is what RateLimitService actually handles; this
    // only stops the connection-level event from being fatal.
    this.redis.on("error", () => {});
  }

  async increment(key: string, windowMs: number) {
    const [count, pttl] = parseLuaPair(await this.redis.eval(INCREMENT_LUA, 1, key, windowMs));
    return { count, resetAfterMs: msOrZero(pttl) };
  }

  async claim(key: string, ttlMs: number) {
    const [claimed, pttl] = parseLuaPair(await this.redis.eval(CLAIM_LUA, 1, key, ttlMs));
    return { claimed: claimed === 1, retryAfterMs: msOrZero(pttl) };
  }
}
