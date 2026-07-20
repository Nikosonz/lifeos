import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ITaskRepository,
  ITaskProjectRepository,
  ITaskLabelRepository,
  IAuditLogRepository,
  TaskWithLabels,
  TaskProject,
  TaskLabel,
} from "@lifeos/db";
import { TaskService } from "../src/tasks/services/task-service";
import { NotFoundError, ValidationError } from "../src/errors/app-error";
import { POSITION_GAP, MIN_GAP } from "../src/tasks/position";

function fakeTaskRepository(
  labelRows: TaskLabel[] = [],
): ITaskRepository & { rows: TaskWithLabels[] } {
  const rows: TaskWithLabels[] = [];

  function resolveLabels(ids: string[] | undefined): TaskLabel[] {
    if (!ids) return [];
    return labelRows.filter((l) => ids.includes(l.id) && !l.deletedAt);
  }

  return {
    rows,
    async create(data) {
      const { labelIds, ...rest } = data;
      const row: TaskWithLabels = {
        id: `task-${rows.length}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        completedAt: null,
        ...rest,
        projectId: rest.projectId ?? null,
        description: rest.description ?? null,
        deadline: rest.deadline ?? null,
        labels: resolveLabels(labelIds),
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((t) => t.id === id) ?? null;
    },
    async findByUserId(userId, opts) {
      return rows
        .filter((t) => t.userId === userId && !t.deletedAt)
        .filter((t) => (opts.status ? t.status === opts.status : true))
        .filter((t) => (opts.projectId ? t.projectId === opts.projectId : true))
        .filter((t) => (opts.labelId ? t.labels.some((l) => l.id === opts.labelId) : true))
        .filter((t) => (opts.cursor ? t.updatedAt < opts.cursor : true))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, opts.limit);
    },
    async update(id, data) {
      const row = rows.find((t) => t.id === id)!;
      const { labelIds, ...rest } = data;
      Object.assign(row, rest, { version: row.version + 1, updatedAt: new Date() });
      if (labelIds !== undefined) row.labels = resolveLabels(labelIds);
      return row;
    },
    async softDelete(id) {
      const row = rows.find((t) => t.id === id)!;
      row.deletedAt = new Date();
      row.version += 1;
      return row;
    },
    async findMaxPosition(userId) {
      const owned = rows.filter((t) => t.userId === userId && !t.deletedAt);
      if (owned.length === 0) return null;
      return Math.max(...owned.map((t) => t.position));
    },
    async findNeighborsForReorder(userId, ids) {
      return rows.filter((t) => t.userId === userId && !t.deletedAt && ids.includes(t.id));
    },
    async renumberPositions(userId, gap) {
      const owned = rows
        .filter((t) => t.userId === userId && !t.deletedAt)
        .sort((a, b) => a.position - b.position);
      owned.forEach((t, index) => {
        t.position = (index + 1) * gap;
      });
    },
    async findByUserIdWithDeadlineInRange(userId, range) {
      return rows.filter(
        (t) =>
          t.userId === userId &&
          !t.deletedAt &&
          t.deadline !== null &&
          t.deadline >= range.gte &&
          t.deadline < range.lt,
      );
    },
    async findCompletionStatsInRange(userId, range) {
      const owned = rows.filter((t) => t.userId === userId && !t.deletedAt);
      const completed = owned.filter(
        (t) => t.completedAt !== null && t.completedAt >= range.gte && t.completedAt < range.lt,
      ).length;
      const created = owned.filter(
        (t) => t.createdAt >= range.gte && t.createdAt < range.lt,
      ).length;
      return { completed, created };
    },
  };
}

function fakeProjectRepository(seed: TaskProject[]): ITaskProjectRepository {
  return {
    async findById(id) {
      return seed.find((p) => p.id === id) ?? null;
    },
  } as ITaskProjectRepository;
}

function fakeLabelRepository(seed: TaskLabel[]): ITaskLabelRepository {
  return {
    async findByIds(ids) {
      return seed.filter((l) => ids.includes(l.id));
    },
  } as ITaskLabelRepository;
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

const project: TaskProject = {
  id: "project-1",
  userId: "user-1",
  name: "Website Redesign",
  description: null,
  color: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
};

const label: TaskLabel = {
  id: "label-1",
  userId: "user-1",
  name: "Urgent",
  color: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
};

function buildService(taskRepo = fakeTaskRepository([label])) {
  const service = new TaskService(
    taskRepo,
    fakeProjectRepository([project]),
    fakeLabelRepository([label]),
    fakeAuditLogRepository(),
  );
  return { service, taskRepo };
}

test("createTask appends at the end of an empty list", async () => {
  const { service } = buildService();
  const task = await service.createTask("user-1", { title: "Design homepage" });
  assert.equal(task.position, POSITION_GAP);
  assert.equal(task.status, "TODO");
  assert.equal(task.priority, "MEDIUM");
});

test("createTask appends after the current max position", async () => {
  const { service } = buildService();
  await service.createTask("user-1", { title: "First" });
  const second = await service.createTask("user-1", { title: "Second" });
  assert.equal(second.position, POSITION_GAP * 2);
});

test("createTask rejects a projectId not owned by the caller", async () => {
  const { service } = buildService();
  await assert.rejects(
    () => service.createTask("user-1", { title: "Task", projectId: "someone-elses-project" }),
    NotFoundError,
  );
});

test("createTask rejects a labelId not owned by the caller", async () => {
  const { service } = buildService();
  await assert.rejects(
    () => service.createTask("user-1", { title: "Task", labelIds: ["someone-elses-label"] }),
    NotFoundError,
  );
});

test("createTask attaches owned labels", async () => {
  const { service } = buildService();
  const task = await service.createTask("user-1", { title: "Task", labelIds: [label.id] });
  assert.deepEqual(
    task.labels.map((l) => l.id),
    [label.id],
  );
});

test("updateTask rejects a task owned by a different user", async () => {
  const { service } = buildService();
  const task = await service.createTask("user-1", { title: "Task" });
  await assert.rejects(
    () => service.updateTask(task.id, "user-2", { title: "Hijacked" }),
    NotFoundError,
  );
});

test("updateTask sets completedAt when transitioning into DONE", async () => {
  const { service } = buildService();
  const task = await service.createTask("user-1", { title: "Task" });
  assert.equal(task.completedAt, null);

  const updated = await service.updateTask(task.id, "user-1", { status: "DONE" });
  assert.ok(updated.completedAt instanceof Date);
});

test("updateTask clears completedAt when transitioning out of DONE", async () => {
  const { service } = buildService();
  const task = await service.createTask("user-1", { title: "Task" });
  const done = await service.updateTask(task.id, "user-1", { status: "DONE" });
  assert.ok(done.completedAt);

  const reopened = await service.updateTask(task.id, "user-1", { status: "TODO" });
  assert.equal(reopened.completedAt, null);
});

test("updateTask can clear projectId/deadline/description by passing null", async () => {
  const { service } = buildService();
  const task = await service.createTask("user-1", {
    title: "Task",
    projectId: project.id,
    deadline: new Date("2026-01-01T00:00:00.000Z"),
    description: "notes",
  });

  const updated = await service.updateTask(task.id, "user-1", {
    projectId: null,
    deadline: null,
    description: null,
  });
  assert.equal(updated.projectId, null);
  assert.equal(updated.deadline, null);
  assert.equal(updated.description, null);
});

test("updateTask rejects repositioning a task relative to itself", async () => {
  const { service } = buildService();
  const task = await service.createTask("user-1", { title: "Task" });
  await assert.rejects(
    () => service.updateTask(task.id, "user-1", { beforeId: task.id }),
    ValidationError,
  );
});

test("updateTask reorder computes the midpoint between two named neighbors", async () => {
  const { service } = buildService();
  const a = await service.createTask("user-1", { title: "A" });
  const b = await service.createTask("user-1", { title: "B" });
  const c = await service.createTask("user-1", { title: "C" });

  const moved = await service.updateTask(c.id, "user-1", { beforeId: a.id, afterId: b.id });
  assert.equal(moved.position, (a.position + b.position) / 2);
});

test("updateTask reorder with only afterId inserts one gap before it", async () => {
  const { service } = buildService();
  const a = await service.createTask("user-1", { title: "A" });
  const b = await service.createTask("user-1", { title: "B" });

  const moved = await service.updateTask(b.id, "user-1", { afterId: a.id });
  assert.equal(moved.position, a.position - POSITION_GAP);
});

test("updateTask reorder rejects a beforeId/afterId that doesn't belong to the caller", async () => {
  const { service } = buildService();
  const task = await service.createTask("user-1", { title: "Task" });
  await assert.rejects(
    () => service.updateTask(task.id, "user-1", { beforeId: "not-a-real-task" }),
    NotFoundError,
  );
});

test("updateTask reorder triggers a renumber when the target gap has collapsed below MIN_GAP", async () => {
  const { service, taskRepo } = buildService();
  const a = await service.createTask("user-1", { title: "A" });
  const b = await service.createTask("user-1", { title: "B" });
  const c = await service.createTask("user-1", { title: "C" });

  // Force a's and b's positions into a tiny gap, as if many prior
  // bisections had already collapsed it below MIN_GAP.
  const aRow = taskRepo.rows.find((t) => t.id === a.id)!;
  const bRow = taskRepo.rows.find((t) => t.id === b.id)!;
  aRow.position = 1000;
  bRow.position = 1000 + MIN_GAP / 2;

  const moved = await service.updateTask(c.id, "user-1", { beforeId: a.id, afterId: b.id });

  // After the renumber, every task (including the moved one's neighbors)
  // should sit on a clean, evenly-spaced value, and the moved task's
  // final position should land strictly between them again.
  const positions = taskRepo.rows
    .filter((t) => t.id !== c.id)
    .map((t) => t.position)
    .sort((x, y) => x - y);
  assert.deepEqual(positions, [POSITION_GAP, POSITION_GAP * 2]);
  assert.ok(moved.position > POSITION_GAP && moved.position < POSITION_GAP * 2);
});

test("deleteTask soft-deletes so the task no longer appears in listTasks", async () => {
  const { service } = buildService();
  const task = await service.createTask("user-1", { title: "Task" });

  await service.deleteTask(task.id, "user-1");
  const results = await service.listTasks("user-1", { limit: 20 });
  assert.equal(results.length, 0);
});
