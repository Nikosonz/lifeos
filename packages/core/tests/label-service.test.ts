import { test } from "node:test";
import assert from "node:assert/strict";
import type { ITaskLabelRepository, IAuditLogRepository, TaskLabel } from "@lifeos/db";
import { LabelNameConflictError } from "@lifeos/db";
import { LabelService } from "../src/tasks/services/label-service";
import { NotFoundError, ConflictError } from "../src/errors/app-error";

function fakeLabelRepository(): ITaskLabelRepository & { rows: TaskLabel[] } {
  const rows: TaskLabel[] = [];
  return {
    rows,
    async create(data) {
      if (rows.some((l) => l.userId === data.userId && l.name === data.name && !l.deletedAt)) {
        throw new LabelNameConflictError();
      }
      const row: TaskLabel = {
        id: `label-${rows.length}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        ...data,
        color: data.color ?? null,
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((l) => l.id === id) ?? null;
    },
    async findByUserId(userId) {
      return rows.filter((l) => l.userId === userId && !l.deletedAt);
    },
    async findByIds(ids) {
      return rows.filter((l) => ids.includes(l.id));
    },
    async update(id, data) {
      const row = rows.find((l) => l.id === id)!;
      if (
        data.name &&
        rows.some(
          (l) => l.id !== id && l.userId === row.userId && l.name === data.name && !l.deletedAt,
        )
      ) {
        throw new LabelNameConflictError();
      }
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    async softDelete(id) {
      const row = rows.find((l) => l.id === id)!;
      row.deletedAt = new Date();
      row.version += 1;
      return row;
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

test("createLabel then listLabels returns the created label for its owner", async () => {
  const service = new LabelService(fakeLabelRepository(), fakeAuditLogRepository());
  await service.createLabel("user-1", { name: "Urgent" });

  const labels = await service.listLabels("user-1");
  assert.equal(labels.length, 1);
  assert.equal(labels[0]?.name, "Urgent");
});

test("createLabel rejects a duplicate name for the same user with ConflictError", async () => {
  const service = new LabelService(fakeLabelRepository(), fakeAuditLogRepository());
  await service.createLabel("user-1", { name: "Urgent" });

  await assert.rejects(() => service.createLabel("user-1", { name: "Urgent" }), ConflictError);
});

test("createLabel allows the same name across two different users", async () => {
  const service = new LabelService(fakeLabelRepository(), fakeAuditLogRepository());
  await service.createLabel("user-1", { name: "Urgent" });
  await service.createLabel("user-2", { name: "Urgent" });

  assert.equal((await service.listLabels("user-1")).length, 1);
  assert.equal((await service.listLabels("user-2")).length, 1);
});

test("updateLabel throws NotFoundError for a label owned by a different user", async () => {
  const service = new LabelService(fakeLabelRepository(), fakeAuditLogRepository());
  const label = await service.createLabel("user-1", { name: "Urgent" });

  await assert.rejects(
    () => service.updateLabel(label.id, "user-2", { name: "Hijacked" }),
    NotFoundError,
  );
});

test("deleteLabel soft-deletes and removes the label from listLabels", async () => {
  const service = new LabelService(fakeLabelRepository(), fakeAuditLogRepository());
  const label = await service.createLabel("user-1", { name: "Urgent" });

  await service.deleteLabel(label.id, "user-1");
  const labels = await service.listLabels("user-1");
  assert.equal(labels.length, 0);
});
