import { z } from "zod";

// Telemetry (ADR-0017): self-hosted crash reporting + analytics, because
// ADR-0014's GMS ban rules out Firebase Crashlytics on the devices this app
// actually targets.

export const TelemetryCrashKind = z.enum(["FLUTTER_ERROR", "UNCAUGHT_ASYNC"]);
export type TelemetryCrashKind = z.infer<typeof TelemetryCrashKind>;

// A closed enum, not free-form strings — ADR-0017's central constraint for
// analytics. Adding an event costs a migration and a contract change, which
// is the point: it keeps the whole analytics surface readable at a glance
// instead of accreting into an untyped bag. There is deliberately no
// properties/metadata object anywhere in this file for the same reason.
export const TelemetryEventName = z.enum([
  "APP_OPENED",
  "SIGNUP_COMPLETED",
  "LOGIN_COMPLETED",
  "TRANSACTION_CREATED",
  "BUDGET_CREATED",
  "TASK_CREATED",
  "HABIT_CHECKED_IN",
  "CALENDAR_EVENT_CREATED",
  "REPORT_VIEWED",
]);
export type TelemetryEventName = z.infer<typeof TelemetryEventName>;

// Bounded on every free-text field. A stack trace is the one genuinely large
// value here and an unbounded one is a trivial way to push megabytes into
// Postgres per request; 20k characters is far more than any real Dart trace
// (a deep one runs ~4-6k) and still small enough to be harmless.
const CrashMessage = z.string().min(1).max(2000);
const StackTrace = z.string().min(1).max(20_000);
const AppVersion = z.string().min(1).max(40);
const Platform = z.string().min(1).max(40);

export const TelemetryCrashInput = z.object({
  kind: TelemetryCrashKind,
  message: CrashMessage,
  stackTrace: StackTrace,
  appVersion: AppVersion,
  platform: Platform,
  osVersion: z.string().max(80).optional(),
  deviceModel: z.string().max(120).optional(),
  // When it happened on-device, not when it arrived. A crashing process
  // usually can't complete a network call, so reports buffer to disk and
  // flush on the next launch — often minutes or days later.
  occurredAt: z.string().datetime(),
});
export type TelemetryCrashInput = z.infer<typeof TelemetryCrashInput>;

export const TelemetryEventInput = z.object({
  name: TelemetryEventName,
  appVersion: AppVersion,
  platform: Platform,
  occurredAt: z.string().datetime(),
});
export type TelemetryEventInput = z.infer<typeof TelemetryEventInput>;

// Batch caps are the real abuse control on these two routes. Phase 5's
// rate limiting is per-IP on unauthenticated routes only (`runRoute` runs
// before `requireUser`, so it has no user identity) — these are
// authenticated, so a bounded batch is what stops one client from writing
// unbounded rows in a single call.
const MAX_CRASHES_PER_BATCH = 20;
const MAX_EVENTS_PER_BATCH = 100;

export const TelemetryCrashBatchInput = z.object({
  crashes: z.array(TelemetryCrashInput).min(1).max(MAX_CRASHES_PER_BATCH),
});
export type TelemetryCrashBatchInput = z.infer<typeof TelemetryCrashBatchInput>;

export const TelemetryEventBatchInput = z.object({
  events: z.array(TelemetryEventInput).min(1).max(MAX_EVENTS_PER_BATCH),
});
export type TelemetryEventBatchInput = z.infer<typeof TelemetryEventBatchInput>;

// Only a count comes back: the client has no use for the stored rows, and
// echoing them would mean sending a stack trace it just uploaded back over
// the wire for nothing.
export const TelemetryIngestResponse = z.object({ accepted: z.number().int().nonnegative() });
export type TelemetryIngestResponse = z.infer<typeof TelemetryIngestResponse>;

export const TELEMETRY_BATCH_LIMITS = {
  crashes: MAX_CRASHES_PER_BATCH,
  events: MAX_EVENTS_PER_BATCH,
} as const;
