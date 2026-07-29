import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/client";
import { UserRepository } from "../src/repositories/user-repository";

// Real-Postgres seam for hardDelete's cascade. The core fake removes one
// entry from an array — it has no foreign keys, so it can never demonstrate
// that a user's wallets, tasks, habits, sessions and telemetry actually go
// with them. That cascade IS the privacy claim ("حذف کامل حساب و
// داده‌هایتان"), so it has to be checked against the real constraints.
// See CLAUDE.md's Testing section for why this tier exists.

const repo = new UserRepository(prisma);

after(async () => {
  await prisma.$disconnect();
});

test("hardDelete cascades to every table the account owns", async () => {
  const user = await prisma.user.create({ data: { phone: `+98902${Date.now()}` } });
  const userId = user.id;

  // One row in each family of child tables, including the two-hop ones
  // (subtask via task, check-in via habit, transaction via wallet+category)
  // where a missing cascade would surface as a foreign-key violation on
  // delete rather than as an orphan.
  const wallet = await prisma.financeWallet.create({ data: { userId, name: "W" } });
  const category = await prisma.financeCategory.create({
    data: { userId, name: "C", type: "EXPENSE" },
  });
  await prisma.financeTransaction.create({
    data: {
      userId,
      walletId: wallet.id,
      categoryId: category.id,
      type: "EXPENSE",
      amount: 1000n,
      occurredAt: new Date(),
    },
  });
  await prisma.financeBudget.create({
    data: { userId, categoryId: category.id, jalaliYear: 1403, jalaliMonth: 5, limitAmount: 5000n },
  });
  const project = await prisma.taskProject.create({ data: { userId, name: "P" } });
  const task = await prisma.task.create({
    data: { userId, projectId: project.id, title: "T", position: 1 },
  });
  await prisma.subtask.create({ data: { userId, taskId: task.id, title: "S", position: 1 } });
  await prisma.taskLabel.create({ data: { userId, name: "L" } });
  const habit = await prisma.habit.create({ data: { userId, name: "H" } });
  await prisma.habitCheckIn.create({
    data: {
      userId,
      habitId: habit.id,
      jalaliYear: 1403,
      jalaliMonth: 5,
      jalaliDay: 1,
      checkedAt: new Date(),
    },
  });
  await prisma.calendarEvent.create({
    data: { userId, title: "E", startAt: new Date(), endAt: new Date() },
  });
  await prisma.notification.create({ data: { userId, type: "TEST", title: "N", body: "B" } });
  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: `hash-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await prisma.telemetryEvent.create({
    data: {
      userId,
      name: "APP_OPENED",
      appVersion: "1.0.0",
      platform: "android",
      occurredAt: new Date(),
    },
  });

  await repo.hardDelete(userId);

  assert.equal(await prisma.user.findUnique({ where: { id: userId } }), null);

  const remaining = await Promise.all([
    prisma.financeWallet.count({ where: { userId } }),
    prisma.financeCategory.count({ where: { userId } }),
    prisma.financeTransaction.count({ where: { userId } }),
    prisma.financeBudget.count({ where: { userId } }),
    prisma.taskProject.count({ where: { userId } }),
    prisma.task.count({ where: { userId } }),
    prisma.subtask.count({ where: { userId } }),
    prisma.taskLabel.count({ where: { userId } }),
    prisma.habit.count({ where: { userId } }),
    prisma.habitCheckIn.count({ where: { userId } }),
    prisma.calendarEvent.count({ where: { userId } }),
    prisma.notification.count({ where: { userId } }),
    prisma.session.count({ where: { userId } }),
    prisma.telemetryEvent.count({ where: { userId } }),
    prisma.telemetryCrash.count({ where: { userId } }),
  ]);
  assert.deepEqual(
    remaining,
    new Array(remaining.length).fill(0),
    "every child table must be empty for this user after the cascade",
  );
});

test("hardDelete leaves audit_logs behind, by design", async () => {
  const user = await prisma.user.create({ data: { phone: `+98903${Date.now()}` } });
  const userId = user.id;
  await prisma.auditLog.create({
    data: { userId, action: "auth.user.deleted", metadata: { channel: "SMS" } },
  });

  await repo.hardDelete(userId);

  // audit_logs.userId is a bare scalar with NO foreign key (schema.prisma),
  // which is what lets the record of an action outlive the account that
  // performed it. If someone ever "fixes" that by adding a relation, this
  // assertion fails and forces the trade-off to be reconsidered rather than
  // silently losing the deletion trail.
  const rows = await prisma.auditLog.findMany({ where: { userId } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.action, "auth.user.deleted");

  // The masking rule means no raw identifier can be sitting here either.
  const metadata = rows[0]?.metadata as Record<string, unknown> | null;
  assert.equal(metadata?.identifier, undefined);

  await prisma.auditLog.deleteMany({ where: { userId } });
});
