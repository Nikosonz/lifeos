import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/client";
import { FinanceTransactionRepository } from "../src/repositories/finance-transaction-repository";
import { IdempotencyKeyRaceError } from "../src/repositories/idempotency-key-repository";
import { uniquePhone } from "./fixtures";

// Real-Postgres seam for createWithIdempotency/updateWithIdempotency's race
// detection — packages/core's fake-backed tests hand-script this exact
// scenario via an armRace() helper, which can only prove the service code
// reacts correctly to whatever the fake is told to throw, never that a real
// Postgres unique-constraint violation actually fires under real
// concurrency. See CLAUDE.md's Testing section and ADR references.

const repo = new FinanceTransactionRepository(prisma);

let userId: string;
let walletId: string;
let categoryId: string;

before(async () => {
  try {
    const user = await prisma.user.create({ data: { phone: uniquePhone() } });
    userId = user.id;
    const wallet = await prisma.financeWallet.create({ data: { userId, name: "Test Wallet" } });
    walletId = wallet.id;
    const category = await prisma.financeCategory.create({
      data: { userId, name: "Test Category", type: "EXPENSE" },
    });
    categoryId = category.id;
  } catch (err) {
    throw new Error(
      "Postgres unreachable at DATABASE_URL — run: docker compose up -d postgres && npm run db:migrate -w packages/db",
      { cause: err },
    );
  }
});

after(async () => {
  // Guarded: if before() failed, userId is undefined and an unguarded delete
  // throws a Prisma validation error that buries the real failure — which is
  // exactly what happened when two files collided on a duplicate phone.
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

function txData(amount = 1000n) {
  return {
    userId,
    walletId,
    categoryId,
    type: "EXPENSE" as const,
    amount,
    currency: "IRR",
    occurredAt: new Date(),
  };
}

test("createWithIdempotency: two concurrent requests with the same key — exactly one succeeds, the other throws IdempotencyKeyRaceError, exactly one row persists", async () => {
  const key = randomUUID();
  const requestHash = "hash-a";
  const data = txData();

  const [r1, r2] = await Promise.allSettled([
    repo.createWithIdempotency(data, { key, requestHash }),
    repo.createWithIdempotency(data, { key, requestHash }),
  ]);

  const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
  const rejected = [r1, r2].filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1, "exactly one concurrent request should succeed");
  assert.equal(rejected.length, 1, "exactly one concurrent request should be rejected");
  assert.ok(
    rejected[0]!.status === "rejected" && rejected[0]!.reason instanceof IdempotencyKeyRaceError,
    "the losing request must throw the real IdempotencyKeyRaceError, not some other error",
  );

  const rows = await prisma.financeTransaction.findMany({
    where: { userId, walletId, amount: 1000n },
  });
  assert.equal(rows.length, 1, "no orphaned duplicate transaction row should survive the race");
});

test("createWithIdempotency: no idempotency key skips the atomic path and always inserts a new row", async () => {
  const before = await prisma.financeTransaction.count({ where: { userId, amount: 2000n } });
  await repo.createWithIdempotency(txData(2000n), null);
  await repo.createWithIdempotency(txData(2000n), null);
  const afterCount = await prisma.financeTransaction.count({ where: { userId, amount: 2000n } });
  assert.equal(afterCount, before + 2);
});

test("updateWithIdempotency: two concurrent updates with the same key — exactly one succeeds, the other throws IdempotencyKeyRaceError", async () => {
  const seed = await repo.createWithIdempotency(txData(3000n), null);
  const key = randomUUID();
  const requestHash = "hash-b";

  const [r1, r2] = await Promise.allSettled([
    repo.updateWithIdempotency(seed.id, { note: "updated" }, userId, { key, requestHash }),
    repo.updateWithIdempotency(seed.id, { note: "updated" }, userId, { key, requestHash }),
  ]);

  const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
  const rejected = [r1, r2].filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(
    rejected[0]!.status === "rejected" && rejected[0]!.reason instanceof IdempotencyKeyRaceError,
  );
});
