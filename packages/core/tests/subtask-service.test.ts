import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ISubtaskRepository,
  ITaskRepository,
  IAuditLogRepository,
  Subtask,
  Task,
} from "@lifeos/db";
import { SubtaskService } from "../src/tasks/services/subtask-service";
import { NotFoundError, ValidationError } from "../src/errors/app-error";
import { POSITION_GAP } from "../src/tasks/position";

function fakeSubtaskRepository(): ISubtaskRepository & { rows: Subtask[] } {
  const rows: Subtask[] = [];
  return {
    rows,
    async create(data) {
      const row: Subtask = {
        id: `subtask-${rows.length}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        completed: false,
        ...data,
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((s) => s.id === id) ?? null;
    },
    async findByTaskId(taskId) {
      return rows
        .filter((s) => s.taskId === taskId && !s.deletedAt)
        .sort((a, b) => a.position - b.position);
    },
    async update(id, data) {
      const row = rows.find((s) => s.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    async softDelete(id) {
      const row = rows.find((s) => s.id === id)!;
      row.deletedAt = new Date();
      row.version += 1;
      return row;
    },
    async findMaxPosition(taskId) {
      const owned = rows.filter((s) => s.taskId === taskId && !s.deletedAt);
      if (owned.length === 0) return null;
      return Math.max(...owned.map((s) => s.position));
    },
    async findNeighborsForReorder(taskId, ids) {
      return rows.filter((s) => s.taskId === taskId && !s.deletedAt && ids.includes(s.id));
    },
    async renumberPositions(taskId, gap) {
      const owned = rows
        .filter((s) => s.taskId === taskId && !s.deletedAt)
        .sort((a, b) => a.position - b.position);
      owned.forEach((s, index) => {
        s.position = (index + 1) * gap;
      });
    },
  };
}

function fakeTaskRepository(seed: Task[]): ITaskRepository {
  return {
    async findById(id) {
      return seed.find((t) => t.id === id) ?? null;
    },
  } as ITaskRepository;
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

function makeTask(overrides: Partial<Task> = {}): Task {
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
    position: POSITION_GAP,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test("createSubtask then listSubtasks returns the created subtask", async () => {
  const task = makeTask();
  const service = new SubtaskService(
    fakeSubtaskRepository(),
    fakeTaskRepository([task]),
    fakeAuditLogRepository(),
  );

  await service.createSubtask(task.id, "user-1", { title: "Write copy" });
  const subtasks = await service.listSubtasks(task.id, "user-1");
  assert.equal(subtasks.length, 1);
  assert.equal(subtasks[0]?.title, "Write copy");
  assert.equal(subtasks[0]?.position, POSITION_GAP);
});

test("createSubtask rejects when the parent task isn't owned by the caller", async () => {
  const task = makeTask();
  const service = new SubtaskService(
    fakeSubtaskRepository(),
    fakeTaskRepository([task]),
    fakeAuditLogRepository(),
  );

  await assert.rejects(
    () => service.createSubtask(task.id, "user-2", { title: "Write copy" }),
    NotFoundError,
  );
});

test("createSubtask rejects when the parent task is soft-deleted", async () => {
  const task = makeTask({ deletedAt: new Date() });
  const service = new SubtaskService(
    fakeSubtaskRepository(),
    fakeTaskRepository([task]),
    fakeAuditLogRepository(),
  );

  await assert.rejects(
    () => service.createSubtask(task.id, "user-1", { title: "Write copy" }),
    NotFoundError,
  );
});

test("updateSubtask rejects repositioning a subtask relative to itself", async () => {
  const task = makeTask();
  const service = new SubtaskService(
    fakeSubtaskRepository(),
    fakeTaskRepository([task]),
    fakeAuditLogRepository(),
  );

  const subtask = await service.createSubtask(task.id, "user-1", { title: "Write copy" });
  await assert.rejects(
    () => service.updateSubtask(task.id, subtask.id, "user-1", { beforeId: subtask.id }),
    ValidationError,
  );
});

test("updateSubtask rejects a beforeId that belongs to a different task", async () => {
  const taskA = makeTask({ id: "task-a" });
  const taskB = makeTask({ id: "task-b" });
  const subtaskRepo = fakeSubtaskRepository();
  const service = new SubtaskService(
    subtaskRepo,
    fakeTaskRepository([taskA, taskB]),
    fakeAuditLogRepository(),
  );

  const subtaskUnderA = await service.createSubtask(taskA.id, "user-1", { title: "A1" });
  const subtaskUnderB = await service.createSubtask(taskB.id, "user-1", { title: "B1" });

  await assert.rejects(
    () =>
      service.updateSubtask(taskB.id, subtaskUnderB.id, "user-1", {
        beforeId: subtaskUnderA.id,
      }),
    NotFoundError,
  );
});

test("updateSubtask reorder computes the midpoint between two named neighbors", async () => {
  const task = makeTask();
  const service = new SubtaskService(
    fakeSubtaskRepository(),
    fakeTaskRepository([task]),
    fakeAuditLogRepository(),
  );

  const a = await service.createSubtask(task.id, "user-1", { title: "A" });
  const b = await service.createSubtask(task.id, "user-1", { title: "B" });
  const c = await service.createSubtask(task.id, "user-1", { title: "C" });

  const moved = await service.updateSubtask(task.id, c.id, "user-1", {
    beforeId: a.id,
    afterId: b.id,
  });
  assert.equal(moved.position, (a.position + b.position) / 2);
});

test("deleteSubtask soft-deletes so the subtask no longer appears in listSubtasks", async () => {
  const task = makeTask();
  const service = new SubtaskService(
    fakeSubtaskRepository(),
    fakeTaskRepository([task]),
    fakeAuditLogRepository(),
  );

  const subtask = await service.createSubtask(task.id, "user-1", { title: "Write copy" });
  await service.deleteSubtask(task.id, subtask.id, "user-1");
  const subtasks = await service.listSubtasks(task.id, "user-1");
  assert.equal(subtasks.length, 0);
});
