import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ICalendarEventRepository,
  IAuditLogRepository,
  ITaskRepository,
  CalendarEvent,
  Task,
} from "@lifeos/db";
import { CalendarEventService } from "../src/calendar/services/calendar-event-service";
import { AgendaService } from "../src/calendar/services/agenda-service";

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

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    userId: "user-1",
    projectId: null,
    title: "Task",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    deadline: null,
    completedAt: null,
    position: 1024,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function fakeTaskRepository(tasks: Task[]): ITaskRepository {
  return {
    async findByUserIdWithDeadlineInRange(userId: string, range: { gte: Date; lt: Date }) {
      return tasks
        .filter((t) => t.userId === userId && !t.deletedAt && t.deadline !== null)
        .filter((t) => t.deadline! >= range.gte && t.deadline! < range.lt);
    },
  } as unknown as ITaskRepository;
}

function buildAgendaService(tasks: Task[]) {
  const eventRepo = fakeCalendarEventRepository();
  const eventService = new CalendarEventService(eventRepo, fakeAuditLogRepository());
  const taskRepo = fakeTaskRepository(tasks);
  return { agendaService: new AgendaService(eventService, taskRepo), eventService };
}

test("listAgendaInRange composes an event and a task deadline, sorted chronologically", async () => {
  const taskWithDeadline = makeTask({
    id: "task-a",
    userId: "user-1",
    title: "Submit report",
    deadline: new Date("2026-04-10T12:00:00.000Z"),
  });
  const { agendaService, eventService } = buildAgendaService([taskWithDeadline]);
  await eventService.createEvent("user-1", {
    title: "Client call",
    startAt: new Date("2026-04-10T08:00:00.000Z"),
    endAt: new Date("2026-04-10T09:00:00.000Z"),
  });

  const items = await agendaService.listAgendaInRange("user-1", {
    gte: new Date("2026-04-10T00:00:00.000Z"),
    lt: new Date("2026-04-11T00:00:00.000Z"),
  });

  const eventsAndTasks = items.filter((i) => i.source !== "holiday");
  assert.deepEqual(
    eventsAndTasks.map((i) => i.source),
    ["event", "task"],
  );
  assert.equal(eventsAndTasks[0]?.title, "Client call");
  assert.equal(eventsAndTasks[1]?.title, "Submit report");
});

test("listAgendaInRange never leaks a different user's task into the result", async () => {
  const otherUsersTask = makeTask({
    id: "task-b",
    userId: "user-2",
    title: "Someone else's task",
    deadline: new Date("2026-04-10T12:00:00.000Z"),
  });
  const { agendaService } = buildAgendaService([otherUsersTask]);

  const items = await agendaService.listAgendaInRange("user-1", {
    gte: new Date("2026-04-10T00:00:00.000Z"),
    lt: new Date("2026-04-11T00:00:00.000Z"),
  });

  assert.equal(
    items.some((i) => i.source === "task"),
    false,
  );
});

test("listAgendaInRange surfaces a holiday when the range spans Nowruz", async () => {
  // 1403/1/1 (Nowruz) = 2024-03-19T20:30:00.000Z Tehran-local midnight (the
  // same reference instant jalali.test.ts already verifies). The range is
  // deliberately narrow to this one day so the adjacent Esfand-29 holiday
  // (which ends at exactly this instant) doesn't also overlap.
  const { agendaService } = buildAgendaService([]);
  const items = await agendaService.listAgendaInRange("user-1", {
    gte: new Date("2024-03-19T20:30:00.000Z"),
    lt: new Date("2024-03-20T20:30:00.000Z"),
  });

  const holidays = items.filter((i) => i.source === "holiday");
  assert.equal(holidays.length, 1);
  assert.equal(holidays[0]?.title, "Nowruz");
});
