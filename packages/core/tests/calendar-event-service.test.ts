import { test } from "node:test";
import assert from "node:assert/strict";
import type { ICalendarEventRepository, IAuditLogRepository, CalendarEvent } from "@lifeos/db";
import { CalendarEventService } from "../src/calendar/services/calendar-event-service";

function fakeCalendarEventRepository(): ICalendarEventRepository & { rows: CalendarEvent[] } {
  const rows: CalendarEvent[] = [];
  return {
    rows,
    async create(data) {
      const row: CalendarEvent = {
        id: `event-${rows.length}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        ...data,
        description: data.description ?? null,
        recurrenceFreq: data.recurrenceFreq ?? null,
        recurrenceInterval: data.recurrenceInterval ?? 1,
        recurrenceCount: data.recurrenceCount ?? null,
        recurrenceUntil: data.recurrenceUntil ?? null,
        recurrenceByWeekday: data.recurrenceByWeekday ?? [],
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((e) => e.id === id) ?? null;
    },
    async update(id, data) {
      const row = rows.find((e) => e.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    async softDelete(id) {
      const row = rows.find((e) => e.id === id)!;
      row.deletedAt = new Date();
      row.version += 1;
      return row;
    },
    async findNonRecurringInRange(userId, range) {
      return rows.filter(
        (e) =>
          e.userId === userId &&
          !e.deletedAt &&
          e.recurrenceFreq === null &&
          e.startAt < range.lt &&
          e.endAt > range.gte,
      );
    },
    async findRecurringForUser(userId) {
      return rows.filter((e) => e.userId === userId && !e.deletedAt && e.recurrenceFreq !== null);
    },
  };
}

function fakeAuditLogRepository(): IAuditLogRepository {
  return {
    async record(data) {
      return {
        id: "audit-0",
        createdAt: new Date(),
        userId: data.userId ?? null,
        action: data.action,
        metadata: null,
      };
    },
  };
}

const baseInput = {
  title: "Team standup",
  startAt: new Date("2026-01-05T09:00:00.000Z"),
  endAt: new Date("2026-01-05T09:30:00.000Z"),
};

test("createEvent then getEvent returns the created event for its owner", async () => {
  const service = new CalendarEventService(fakeCalendarEventRepository(), fakeAuditLogRepository());
  const event = await service.createEvent("user-1", baseInput);

  const fetched = await service.getEvent(event.id, "user-1");
  assert.equal(fetched.title, "Team standup");
  assert.equal(fetched.recurrenceFreq, null);
});

// Cross-user rejection on updateEvent/deleteEvent is OwnedResourceCrud's
// own generic behavior, tested once in owned-resource-crud.test.ts — this
// is a wiring smoke test confirming CalendarEventService's updateEvent
// actually reaches it and applies the change for the real owner (see
// ADR-0010).
test("updateEvent changes the title for its real owner", async () => {
  const service = new CalendarEventService(fakeCalendarEventRepository(), fakeAuditLogRepository());
  const event = await service.createEvent("user-1", baseInput);

  const updated = await service.updateEvent(event.id, "user-1", { title: "Renamed" });

  assert.equal(updated.title, "Renamed");
});

test("deleteEvent soft-deletes so the event no longer appears in listOccurrencesInRange", async () => {
  const service = new CalendarEventService(fakeCalendarEventRepository(), fakeAuditLogRepository());
  const event = await service.createEvent("user-1", baseInput);

  await service.deleteEvent(event.id, "user-1");
  const occurrences = await service.listOccurrencesInRange("user-1", {
    gte: new Date("2026-01-01T00:00:00.000Z"),
    lt: new Date("2026-01-10T00:00:00.000Z"),
  });
  assert.equal(occurrences.length, 0);
});

test("listOccurrencesInRange composes non-recurring and recurring events, sorted chronologically", async () => {
  const service = new CalendarEventService(fakeCalendarEventRepository(), fakeAuditLogRepository());
  await service.createEvent("user-1", {
    title: "One-off meeting",
    startAt: new Date("2026-01-07T10:00:00.000Z"),
    endAt: new Date("2026-01-07T11:00:00.000Z"),
  });
  await service.createEvent("user-1", {
    title: "Weekly sync",
    startAt: new Date("2026-01-05T09:00:00.000Z"),
    endAt: new Date("2026-01-05T09:30:00.000Z"),
    recurrenceFreq: "WEEKLY",
    recurrenceByWeekday: [1],
  });

  const occurrences = await service.listOccurrencesInRange("user-1", {
    gte: new Date("2026-01-01T00:00:00.000Z"),
    lt: new Date("2026-01-15T00:00:00.000Z"),
  });

  assert.deepEqual(
    occurrences.map((o) => o.title),
    ["Weekly sync", "One-off meeting", "Weekly sync"],
  );
  assert.equal(occurrences[0]?.isRecurring, true);
  assert.equal(occurrences[1]?.isRecurring, false);
});

test("listOccurrencesInRange never returns another user's events", async () => {
  const service = new CalendarEventService(fakeCalendarEventRepository(), fakeAuditLogRepository());
  await service.createEvent("user-1", baseInput);

  const occurrences = await service.listOccurrencesInRange("user-2", {
    gte: new Date("2026-01-01T00:00:00.000Z"),
    lt: new Date("2026-01-10T00:00:00.000Z"),
  });
  assert.equal(occurrences.length, 0);
});
