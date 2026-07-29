import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  CreateCrashData,
  CreateEventData,
  ITelemetryCrashRepository,
  ITelemetryEventRepository,
} from "@lifeos/db";
import { TelemetryService } from "../src/telemetry/services/telemetry-service";

// Backing arrays typed against the real repository input types, not `any` —
// same rule every other fake in this directory follows.
function fakeCrashRepository(): ITelemetryCrashRepository & { rows: CreateCrashData[] } {
  const rows: CreateCrashData[] = [];
  return {
    rows,
    async createMany(batch) {
      rows.push(...batch);
      return batch.length;
    },
    async countForUser(userId) {
      return rows.filter((r) => r.userId === userId).length;
    },
  };
}

function fakeEventRepository(): ITelemetryEventRepository & { rows: CreateEventData[] } {
  const rows: CreateEventData[] = [];
  return {
    rows,
    async createMany(batch) {
      rows.push(...batch);
      return batch.length;
    },
    async countForUser(userId) {
      return rows.filter((r) => r.userId === userId).length;
    },
  };
}

function makeService() {
  const crashRepo = fakeCrashRepository();
  const eventRepo = fakeEventRepository();
  return { service: new TelemetryService(crashRepo, eventRepo), crashRepo, eventRepo };
}

const occurredAt = new Date("2026-07-20T08:30:00.000Z");

test("ingestCrashes stamps every row with the caller's userId", async () => {
  const { service, crashRepo } = makeService();

  const accepted = await service.ingestCrashes("user-1", [
    {
      kind: "FLUTTER_ERROR",
      message: "boom",
      stackTrace: "#0 main",
      appVersion: "1.0.0",
      platform: "android",
      occurredAt,
    },
    {
      kind: "UNCAUGHT_ASYNC",
      message: "async boom",
      stackTrace: "#0 future",
      appVersion: "1.0.0",
      platform: "android",
      occurredAt,
    },
  ]);

  assert.equal(accepted, 2);
  assert.equal(crashRepo.rows.length, 2);
  // The client never supplies a userId — it comes from the Bearer token, so
  // one user can't file a crash against another's account.
  assert.ok(crashRepo.rows.every((r) => r.userId === "user-1"));
});

test("ingestCrashes preserves the on-device occurredAt, not an ingest time", async () => {
  const { service, crashRepo } = makeService();

  await service.ingestCrashes("user-1", [
    {
      kind: "FLUTTER_ERROR",
      message: "boom",
      stackTrace: "#0 main",
      appVersion: "1.0.0",
      platform: "android",
      occurredAt,
    },
  ]);

  // The whole point of buffering to disk: a crash flushed on the next launch
  // arrives long after it happened, so the instant it happened has to survive
  // ingest intact or every report clusters at flush time instead.
  assert.equal(crashRepo.rows[0]!.occurredAt.toISOString(), occurredAt.toISOString());
});

test("ingestCrashes carries optional device context through when present", async () => {
  const { service, crashRepo } = makeService();

  await service.ingestCrashes("user-1", [
    {
      kind: "FLUTTER_ERROR",
      message: "boom",
      stackTrace: "#0 main",
      appVersion: "1.2.3",
      platform: "android",
      osVersion: "Android 14",
      deviceModel: "Pixel 7",
      occurredAt,
    },
  ]);

  assert.equal(crashRepo.rows[0]!.osVersion, "Android 14");
  assert.equal(crashRepo.rows[0]!.deviceModel, "Pixel 7");
});

test("ingestEvents stamps userId and returns the accepted count", async () => {
  const { service, eventRepo } = makeService();

  const accepted = await service.ingestEvents("user-2", [
    { name: "APP_OPENED", appVersion: "1.0.0", platform: "android", occurredAt },
    { name: "TASK_CREATED", appVersion: "1.0.0", platform: "android", occurredAt },
    { name: "HABIT_CHECKED_IN", appVersion: "1.0.0", platform: "android", occurredAt },
  ]);

  assert.equal(accepted, 3);
  assert.equal(eventRepo.rows.length, 3);
  assert.ok(eventRepo.rows.every((r) => r.userId === "user-2"));
});

test("an empty batch is a no-op rather than an error", async () => {
  const { service, crashRepo, eventRepo } = makeService();

  // The contract's own `.min(1)` rejects an empty batch at the route, so this
  // never happens over HTTP — but the service shouldn't blow up if some
  // future in-process caller passes one.
  assert.equal(await service.ingestCrashes("user-1", []), 0);
  assert.equal(await service.ingestEvents("user-1", []), 0);
  assert.equal(crashRepo.rows.length, 0);
  assert.equal(eventRepo.rows.length, 0);
});

test("crashes and events are stored independently of each other", async () => {
  const { service, crashRepo, eventRepo } = makeService();

  await service.ingestCrashes("user-1", [
    {
      kind: "UNCAUGHT_ASYNC",
      message: "boom",
      stackTrace: "#0 main",
      appVersion: "1.0.0",
      platform: "android",
      occurredAt,
    },
  ]);
  await service.ingestEvents("user-1", [
    { name: "APP_OPENED", appVersion: "1.0.0", platform: "android", occurredAt },
  ]);

  assert.equal(await crashRepo.countForUser("user-1"), 1);
  assert.equal(await eventRepo.countForUser("user-1"), 1);
});
