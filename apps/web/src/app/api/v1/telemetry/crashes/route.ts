import { TelemetryCrashBatchInput, TelemetryIngestResponse } from "@lifeos/contracts";
import { telemetryService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";

// Authenticated, like every other write route — which means a crash that
// happens before a user ever logs in is not reportable. That's a real and
// deliberate limitation: the alternative is an unauthenticated write
// endpoint, which is an open invitation to write arbitrary rows into our
// database, and pre-login crashes are the narrowest slice of a small app's
// crash surface. Revisit only with a signed-client scheme, never by simply
// dropping the auth check.
//
// Batch size is capped by TelemetryCrashBatchInput itself (20), which is
// this route's real abuse control — Phase 5's rate limiting is per-IP on
// unauthenticated routes only.
export const POST = defineRoute(
  { body: TelemetryCrashBatchInput, response: TelemetryIngestResponse },
  async ({ userId, body: { crashes } }) => {
    const accepted = await telemetryService.ingestCrashes(
      userId,
      crashes.map((crash) => ({
        kind: crash.kind,
        message: crash.message,
        stackTrace: crash.stackTrace,
        appVersion: crash.appVersion,
        platform: crash.platform,
        ...(crash.osVersion !== undefined ? { osVersion: crash.osVersion } : {}),
        ...(crash.deviceModel !== undefined ? { deviceModel: crash.deviceModel } : {}),
        occurredAt: new Date(crash.occurredAt),
      })),
    );

    return { accepted };
  },
);
