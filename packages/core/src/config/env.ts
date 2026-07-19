import { z } from "zod";

const EnvSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
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
