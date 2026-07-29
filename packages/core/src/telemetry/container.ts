import { prisma, TelemetryCrashRepository, TelemetryEventRepository } from "@lifeos/db";
import { TelemetryService } from "./services/telemetry-service";

// Composition root for the telemetry module — the only file here that
// imports @lifeos/db, same as every other module's container.
const crashRepository = new TelemetryCrashRepository(prisma);
const eventRepository = new TelemetryEventRepository(prisma);

export const telemetryService = new TelemetryService(crashRepository, eventRepository);
