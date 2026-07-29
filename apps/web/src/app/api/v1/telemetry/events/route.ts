import { TelemetryEventBatchInput } from "@lifeos/contracts";
import { telemetryService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

// Same auth + batch-cap reasoning as the crashes route; see its comment.
// `name` is a closed enum in the contract, so an unknown event name is a
// 400 rather than a silently-stored string — the whole point of ADR-0017's
// "typed event enum, not free-form strings".
export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const { events } = TelemetryEventBatchInput.parse(await req.json());

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
});
