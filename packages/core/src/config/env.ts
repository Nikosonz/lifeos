import { z } from "zod";
import { logger } from "../logging/logger";

/**
 * Every environment variable this system reads, declared in one place.
 *
 * **Requirements are conditional on NODE_ENV, not absolute.** A schema that
 * demanded DATABASE_URL unconditionally would break `npm test` in every
 * workspace — core's unit tests are fake-backed and never open a socket, so
 * forcing them to invent a connection string just to load a module is the
 * exact friction that made getEnv() lazy in the first place. Production, by
 * contrast, has no excuse for a missing value: the superRefine below turns
 * each one into a hard failure there.
 *
 * The failure surfaces on the first getEnv() call, which in apps/web is the
 * first request (client-ip.ts reads TRUSTED_PROXY_IP_HEADER on every route).
 * That is early enough to be a deploy-time signal rather than a slow leak.
 */
const EnvSchema = z
  .object({
    // Next.js and node set this; the default only covers a bare `tsx` run.
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),

    // Read by Prisma directly rather than through this schema, so validating
    // it here buys a clear error message instead of Prisma's connection
    // failure several layers down.
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, "DATABASE_URL must be a postgres:// or postgresql:// URL")
      .optional(),

    // Optional outside production. Unset selects InMemoryRateLimitStore,
    // which keeps `npm run dev` and the unit-test run working with no
    // docker — the same "mock adapter unless configured" shape SMS_PROVIDER
    // uses. In production it is REQUIRED, and that is not a style
    // preference: the in-memory store counts per process, so N instances
    // would each enforce their own full copy of every limit, silently
    // multiplying every cap by N.
    REDIS_URL: z.url().optional(),

    // Which request header (if any) may be trusted to carry the real client
    // IP. Deliberately has no default: unset means "no header is
    // trustworthy", and the limiter falls back to x-forwarded-for on a
    // best-effort basis. Set this only once a reverse proxy that
    // *overwrites* the header is actually in front of the app (Cloudflare →
    // "cf-connecting-ip"); pointing it at a header the proxy merely appends
    // to would be worse than leaving it unset, since a client could then
    // prepend a forged value. See apps/web/src/lib/client-ip.ts.
    TRUSTED_PROXY_IP_HEADER: z.string().min(1).optional(),

    SMS_PROVIDER: z.enum(["mock", "kavenegar"]).default("mock"),
    KAVENEGAR_API_KEY: z.string().min(1).optional(),

    // Same "mock unless configured" shape as SMS_PROVIDER, but unlike SMS
    // this one has a real adapter — email is the only channel a production
    // user can actually sign in through today, so a production deploy that
    // leaves this at "mock" has no working login at all. The superRefine
    // below makes that a startup failure rather than a discovery.
    EMAIL_PROVIDER: z.enum(["mock", "resend"]).default("mock"),
    RESEND_API_KEY: z.string().min(1).optional(),
    // Must be a verified Resend sending domain, in either "addr@domain" or
    // "Display Name <addr@domain>" form.
    EMAIL_FROM: z.string().min(3).optional(),

    // Dev-only escape hatch: fixes every OTP to this value. Validated here
    // *in addition to* the fail-closed check in auth/crypto.ts, not instead
    // of it — this catches a misconfigured deploy on the first request,
    // while crypto.ts catches it at the moment a code would be generated.
    // Two layers because a fixed OTP is a total authentication bypass.
    DEV_OTP_CODE: z
      .string()
      .regex(/^\d{6}$/, "DEV_OTP_CODE must be exactly 6 digits")
      .optional(),
  })
  .superRefine((env, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (env.NODE_ENV === "production") {
      if (env.DEV_OTP_CODE !== undefined) {
        fail(
          "DEV_OTP_CODE",
          "DEV_OTP_CODE must never be set in production — it disables OTP security entirely, " +
            "and also disables per-IP rate limiting (see rate-limit-service.ts).",
        );
      }
      if (env.REDIS_URL === undefined) {
        fail(
          "REDIS_URL",
          "REDIS_URL is required in production — without it the rate limiter falls back to an " +
            "in-process store that counts per instance, so every limit is silently multiplied " +
            "by the number of running instances.",
        );
      }
      if (env.DATABASE_URL === undefined) {
        fail("DATABASE_URL", "DATABASE_URL is required in production.");
      }
      // Login is OTP-only and SMS has no real adapter yet, so a production
      // instance on the mock email provider is one where nobody can sign
      // in — and where every OTP would be written to the container log.
      // MockEmailProvider throws too; this catches it at startup instead of
      // at the first person trying to log in.
      if (env.EMAIL_PROVIDER === "mock") {
        fail(
          "EMAIL_PROVIDER",
          'EMAIL_PROVIDER must be "resend" in production — email is the only working login ' +
            "channel, and the mock provider logs OTP codes instead of sending them.",
        );
      }
    }

    // Independent of NODE_ENV: selecting a provider without its credential
    // is a misconfiguration anywhere, and the failure would otherwise only
    // appear when someone tried to sign in.
    if (env.SMS_PROVIDER === "kavenegar" && env.KAVENEGAR_API_KEY === undefined) {
      fail("KAVENEGAR_API_KEY", 'KAVENEGAR_API_KEY is required when SMS_PROVIDER is "kavenegar".');
    }

    if (env.EMAIL_PROVIDER === "resend") {
      if (env.RESEND_API_KEY === undefined) {
        fail("RESEND_API_KEY", 'RESEND_API_KEY is required when EMAIL_PROVIDER is "resend".');
      }
      if (env.EMAIL_FROM === undefined) {
        fail(
          "EMAIL_FROM",
          'EMAIL_FROM is required when EMAIL_PROVIDER is "resend" — Resend rejects a send with ' +
            "no from address, and it must be on a verified domain.",
        );
      }
    }
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

    // A warning rather than a hard failure, deliberately. Per-IP limits
    // still function without a trusted header — they just become
    // best-effort, stopping naive scripted abuse while a determined
    // attacker rotating x-forwarded-for walks past them. Refusing to boot
    // over that would block an otherwise-healthy deploy; staying silent
    // would let a limiter that enforces nothing look like one that does.
    if (cached.NODE_ENV === "production" && !cached.TRUSTED_PROXY_IP_HEADER) {
      logger.warn(
        { event: "config.untrusted_client_ip" },
        "TRUSTED_PROXY_IP_HEADER is unset in production — per-IP rate limits are best-effort " +
          "and can be bypassed by forging x-forwarded-for. Set it to the header your reverse " +
          "proxy overwrites (e.g. cf-connecting-ip).",
      );
    }
  }
  return cached;
}

/**
 * Test-only. getEnv() memoizes on first call, which is correct for a
 * process whose environment never changes — but a test that needs to
 * exercise a *different* configuration would otherwise be at the mercy of
 * whichever test ran first.
 */
export function resetEnvCacheForTests(): void {
  cached = undefined;
}
