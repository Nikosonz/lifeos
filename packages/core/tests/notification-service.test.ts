import { test } from "node:test";
import assert from "node:assert/strict";
import type { INotificationRepository, IAuditLogRepository, Notification } from "@lifeos/db";
import { NotificationService } from "../src/notifications/services/notification-service";
import { NotFoundError } from "../src/errors/app-error";

function fakeNotificationRepository(): INotificationRepository & { rows: Notification[] } {
  const rows: Notification[] = [];
  return {
    rows,
    async create(data) {
      const row: Notification = {
        id: `notif-${rows.length}`,
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        readAt: null,
        data: (data.data ?? null) as Notification["data"],
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((n) => n.id === id) ?? null;
    },
    async findByUserId(userId, opts) {
      return rows
        .filter((n) => n.userId === userId && !n.deletedAt)
        .filter((n) => (opts.cursor ? n.updatedAt < opts.cursor : true))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, opts.limit);
    },
    async countUnread(userId) {
      return rows.filter((n) => n.userId === userId && !n.deletedAt && !n.readAt).length;
    },
    async markRead(id) {
      const row = rows.find((n) => n.id === id)!;
      row.readAt = new Date();
      row.version += 1;
      return row;
    },
    async markAllRead(userId) {
      const targets = rows.filter((n) => n.userId === userId && !n.deletedAt && !n.readAt);
      for (const row of targets) {
        row.readAt = new Date();
        row.version += 1;
      }
      return targets.length;
    },
  };
}

let auditCount = 0;
function fakeAuditLogRepository(): IAuditLogRepository {
  return {
    async record(data) {
      auditCount += 1;
      return {
        id: `audit-${auditCount}`,
        createdAt: new Date(),
        userId: data.userId ?? null,
        action: data.action,
        metadata: null,
      };
    },
  };
}

function buildService() {
  const notificationRepo = fakeNotificationRepository();
  const service = new NotificationService(notificationRepo, fakeAuditLogRepository());
  return { service, notificationRepo };
}

test("create writes a notification and one audit row", async () => {
  const { service, notificationRepo } = buildService();
  const before = auditCount;
  await service.create("user-1", {
    type: "FINANCE_BUDGET_EXCEEDED",
    title: "t",
    body: "b",
  });
  assert.equal(notificationRepo.rows.length, 1);
  assert.equal(auditCount, before + 1);
});

test("listForUser cursor pagination returns only the requested page", async () => {
  const { service } = buildService();
  for (let i = 0; i < 3; i += 1) {
    await service.create("user-1", { type: "FINANCE_BUDGET_EXCEEDED", title: `t${i}`, body: "b" });
  }
  const page = await service.listForUser("user-1", { limit: 2 });
  assert.equal(page.length, 2);
});

test("getUnreadCount reflects only unread, non-deleted notifications for that user", async () => {
  const { service } = buildService();
  await service.create("user-1", { type: "FINANCE_BUDGET_EXCEEDED", title: "a", body: "b" });
  await service.create("user-1", { type: "FINANCE_BUDGET_EXCEEDED", title: "b", body: "b" });
  await service.create("user-2", { type: "FINANCE_BUDGET_EXCEEDED", title: "c", body: "b" });
  assert.equal(await service.getUnreadCount("user-1"), 2);
});

test("markRead rejects a notification owned by a different user", async () => {
  const { service } = buildService();
  const notification = await service.create("user-1", {
    type: "FINANCE_BUDGET_EXCEEDED",
    title: "a",
    body: "b",
  });
  await assert.rejects(() => service.markRead(notification.id, "user-2"), NotFoundError);
});

test("markRead is idempotent: reading an already-read notification is a no-op", async () => {
  const { service, notificationRepo } = buildService();
  const notification = await service.create("user-1", {
    type: "FINANCE_BUDGET_EXCEEDED",
    title: "a",
    body: "b",
  });
  const first = await service.markRead(notification.id, "user-1");
  const versionAfterFirst = notificationRepo.rows[0]?.version;
  const second = await service.markRead(notification.id, "user-1");
  assert.equal(first.readAt?.getTime(), second.readAt?.getTime());
  assert.equal(notificationRepo.rows[0]?.version, versionAfterFirst);
});

test("markAllRead updates every unread notification for that user and returns the count", async () => {
  const { service } = buildService();
  await service.create("user-1", { type: "FINANCE_BUDGET_EXCEEDED", title: "a", body: "b" });
  await service.create("user-1", { type: "FINANCE_BUDGET_EXCEEDED", title: "b", body: "b" });
  await service.create("user-2", { type: "FINANCE_BUDGET_EXCEEDED", title: "c", body: "b" });

  const result = await service.markAllRead("user-1");
  assert.equal(result.updatedCount, 2);
  assert.equal(await service.getUnreadCount("user-1"), 0);
  assert.equal(await service.getUnreadCount("user-2"), 1);
});
