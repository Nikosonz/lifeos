import { TelemetryEventBatchInput, TelemetryIngestResponse } from "@lifeos/contracts";
import { telemetryService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";

// Same auth + batch-cap reasoning as the crashes route; see its comment.
// `name` is a closed enum in the contract, so an unknown event name is a
// 400 rather than a silently-stored string — the whole point of ADR-0017's
// "typed event enum, not free-form strings".
export const POST = defineRoute(
  { body: TelemetryEventBatchInput, response: TelemetryIngestResponse },
  async ({ userId, body: { events } }) => {
    const accepted = await telemetryService.ingestEvents(
      userId,
      events.map((event) => ({
        name: event.name,
        appVersion: event.appVersion,
        platform: event.platform,
        occurredAt: new Date(event.occurredAt),
      })),
    );

    return { accepted };
  },
);
