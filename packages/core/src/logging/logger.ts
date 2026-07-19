import { pino } from "pino";

// Module-level singleton — pino instances are expensive to construct
// per-request. `apps/web` and `apps/worker` both import this same logger so
// log format is identical across the HTTP and job-queue processes.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: null, // omit pid/hostname — noisy in single-container logs
});

export function loggerForRequest(requestId: string) {
  return logger.child({ requestId });
}
