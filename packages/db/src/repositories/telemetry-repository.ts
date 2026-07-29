import type {
  PrismaClient,
  TelemetryCrash,
  TelemetryEvent,
  TelemetryCrashKind,
  TelemetryEventName,
} from "../../generated/prisma/index";

export interface CreateCrashData {
  userId: string;
  kind: TelemetryCrashKind;
  message: string;
  stackTrace: string;
  appVersion: string;
  platform: string;
  osVersion?: string | undefined;
  deviceModel?: string | undefined;
  occurredAt: Date;
}

export interface CreateEventData {
  userId: string;
  name: TelemetryEventName;
  appVersion: string;
  platform: string;
  occurredAt: Date;
}

// Two repositories rather than one "telemetry" repository, matching the
// one-repository-per-model rule every other module follows — crashes and
// events share a module, not a table.
export interface ITelemetryCrashRepository {
  createMany(rows: CreateCrashData[]): Promise<number>;
  countForUser(userId: string): Promise<number>;
}

export interface ITelemetryEventRepository {
  createMany(rows: CreateEventData[]): Promise<number>;
  countForUser(userId: string): Promise<number>;
}

export class TelemetryCrashRepository implements ITelemetryCrashRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // createMany, not a loop of create(): a flush after a crashy session can
  // carry a whole batch, and this is one round trip and one implicit
  // transaction rather than N of each. Nothing here needs the created rows
  // back — the client already has them — so returning a count is enough.
  async createMany(rows: CreateCrashData[]): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await this.prisma.telemetryCrash.createMany({
      // The two optional columns are normalized to an explicit null rather
      // than passed through as `undefined`. Under this repo's
      // `exactOptionalPropertyTypes`, an optional `string | undefined`
      // property is not assignable to Prisma's nullable `string | null`
      // input — and "absent" and "null" are the same thing for a column
      // that is simply unknown on this device.
      data: rows.map((row) => ({
        ...row,
        osVersion: row.osVersion ?? null,
        deviceModel: row.deviceModel ?? null,
      })),
    });
    return result.count;
  }

  countForUser(userId: string): Promise<number> {
    return this.prisma.telemetryCrash.count({ where: { userId, deletedAt: null } });
  }
}

export class TelemetryEventRepository implements ITelemetryEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(rows: CreateEventData[]): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await this.prisma.telemetryEvent.createMany({ data: rows });
    return result.count;
  }

  countForUser(userId: string): Promise<number> {
    return this.prisma.telemetryEvent.count({ where: { userId, deletedAt: null } });
  }
}

export type { TelemetryCrash, TelemetryEvent };
