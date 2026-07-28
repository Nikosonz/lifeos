import { z } from "zod";

const EnvSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),

  // Optional on purpose. Unset selects InMemoryRateLimitStore, which keeps
  // `npm run dev` and the unit-test run working with no docker — the same
  // "mock adapter unless configured" shape SMS_PROVIDER already uses. A
  // multi-instance deploy MUST set it: the in-memory store counts per
  // process, so N instances would enforce N× the intended limit.
  REDIS_URL: z.url().optional(),

  // Which request header (if any) may be trusted to carry the real client
  // IP. Deliberately has no default: an unset value means "no header is
  // trustworthy", and the limiter falls back to x-forwarded-for on a
  // best-effort basis. Set this only once a reverse proxy that *overwrites*
  // the header is actually in front of the app (Stage C's Cloudflare →
  // "cf-connecting-ip"); pointing it at a header the proxy merely appends
  // to would be worse than leaving it unset, since a client could then
  // prepend a forged value. See CLAUDE.md's note on ipAddress being
  // client-suppliable.
  TRUSTED_PROXY_IP_HEADER: z.string().min(1).optional(),
});

type Env = z.infer<typeof EnvSchema>;

// Lazy + memoized: reading process.env at module-import time would make
// every test file that transitively imports jwt.ts require real secrets
// just to load. Validation still fails fast — on first actual use, which
// in apps/web happens at the first request anyway.
let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
    }
    cached = parsed.data;
  }
  return cached;
}
