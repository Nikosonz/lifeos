import type {
  ITelemetryCrashRepository,
  ITelemetryEventRepository,
  TelemetryCrashKind,
  TelemetryEventName,
} from "@lifeos/db";
import { logger } from "../../logging/logger";

export interface IngestCrashInput {
  kind: TelemetryCrashKind;
  message: string;
  stackTrace: string;
  appVersion: string;
  platform: string;
  osVersion?: string | undefined;
  deviceModel?: string | undefined;
  occurredAt: Date;
}

export interface IngestEventInput {
  name: TelemetryEventName;
  appVersion: string;
  platform: string;
  occurredAt: Date;
}

/**
 * Ingest-only, by design. There is no read side, no list endpoint, and no
 * per-row service method — the whole module exists so operators can query
 * `telemetry_crashes`/`telemetry_events` directly (psql today, a real
 * dashboard whenever there's a deployed backend to point one at). Adding a
 * read API before anything consumes it would be the speculative-flexibility
 * mistake ADR-0009 and ADR-0019 both already rejected elsewhere.
 *
 * Deliberately writes **no audit-log rows**, unlike every other mutating
 * service in this codebase. The audit log is the record of what a *user*
 * did; a crash report is something that happened *to* them, and a batch
 * flush of 20 buffered crashes would otherwise write 20 audit rows
 * describing nothing anyone would ever query. Ingest volume is also the one
 * place in this app where write amplification is a real concern.
 */
export class TelemetryService {
  constructor(
    private readonly crashRepository: ITelemetryCrashRepository,
    private readonly eventRepository: ITelemetryEventRepository,
  ) {}

  async ingestCrashes(userId: string, crashes: IngestCrashInput[]): Promise<number> {
    const accepted = await this.crashRepository.createMany(
      crashes.map((crash) => ({ userId, ...crash })),
    );
    // Logged at warn, not info: a crash reaching here means the app died on
    // someone's device. This is the one telemetry signal worth seeing in the
    // server log without querying Postgres — the `event` name matches the
    // stable-name convention every other module's logging follows.
    logger.warn(
      {
        event: "telemetry.crash.ingested",
        userId,
        count: accepted,
        kinds: [...new Set(crashes.map((c) => c.kind))],
      },
      "crash reports ingested",
    );
    return accepted;
  }

  async ingestEvents(userId: string, events: IngestEventInput[]): Promise<number> {
    const accepted = await this.eventRepository.createMany(
      events.map((event) => ({ userId, ...event })),
    );
    logger.debug(
      { event: "telemetry.events.ingested", userId, count: accepted },
      "analytics events ingested",
    );
    return accepted;
  }
}
