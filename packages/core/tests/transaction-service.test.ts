import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  IFinanceTransactionRepository,
  IFinanceWalletRepository,
  IFinanceCategoryRepository,
  IIdempotencyKeyRepository,
  IAuditLogRepository,
  FinanceTransaction,
  FinanceWallet,
  FinanceCategory,
  IdempotencyKey,
} from "@lifeos/db";
import { IdempotencyKeyRaceError } from "@lifeos/db";
import {
  TransactionService,
  hashCreateTransactionInput,
  type CreateTransactionInput,
} from "../src/finance/services/transaction-service";
import { ConflictError, NotFoundError } from "../src/errors/app-error";

interface RaceSetup {
  key: string;
  userId: string;
  requestHash: string;
  resourceId: string;
}

// Models the atomic behavior of FinanceTransactionRepository.createWithIdempotency:
// a (userId, key) clash throws IdempotencyKeyRaceError instead of writing a
// duplicate row. `armRace` lets a test manufacture the TOCTOU window a real
// concurrent request would create — the up-front findByUserAndKey check
// sees nothing yet, but the write itself loses the race deterministically.
function fakeTransactionRepository(): IFinanceTransactionRepository & {
  rows: FinanceTransaction[];
  idempotencyRows: IdempotencyKey[];
  armRace: (setup: RaceSetup) => void;
} {
  const rows: FinanceTransaction[] = [];
  const idempotencyRows: IdempotencyKey[] = [];
  let armedRace: RaceSetup | null = null;

  function makeRow(data: {
    userId: string;
    walletId: string;
    categoryId: string;
    type: "INCOME" | "EXPENSE";
    amount: bigint;
    currency: string;
    occurredAt: Date;
    note?: string | null;
  }): FinanceTransaction {
    return {
      id: `tx-${rows.length}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      version: 1,
      note: data.note ?? null,
      ...data,
    };
  }

  function recordIdempotency(setup: RaceSetup) {
    idempotencyRows.push({
      id: `idem-${idempotencyRows.length}`,
      userId: setup.userId,
      key: setup.key,
      requestHash: setup.requestHash,
      resourceType: "finance_transaction",
      resourceId: setup.resourceId,
      createdAt: new Date(),
    });
  }

  return {
    rows,
    idempotencyRows,
    armRace(setup) {
      armedRace = setup;
    },
    async create(data) {
      const row = makeRow(data);
      rows.push(row);
      return row;
    },
    async createWithIdempotency(data, idempotency) {
      if (!idempotency) {
        const row = makeRow(data);
        rows.push(row);
        return row;
      }
      if (armedRace && armedRace.userId === data.userId && armedRace.key === idempotency.key) {
        const race = armedRace;
        armedRace = null;
        recordIdempotency(race);
        throw new IdempotencyKeyRaceError();
      }
      const clash = idempotencyRows.find(
        (k) => k.userId === data.userId && k.key === idempotency.key,
      );
      if (clash) throw new IdempotencyKeyRaceError();
      const row = makeRow(data);
      rows.push(row);
      recordIdempotency({
        userId: data.userId,
        key: idempotency.key,
        requestHash: idempotency.requestHash,
        resourceId: row.id,
      });
      return row;
    },
    async update(id, data) {
      const row = rows.find((r) => r.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    async updateWithIdempotency(id, data, userId, idempotency) {
      if (!idempotency) {
        const row = rows.find((r) => r.id === id)!;
        Object.assign(row, data, { version: row.version + 1 });
        return row;
      }
      const clash = idempotencyRows.find((k) => k.userId === userId && k.key === idempotency.key);
      if (clash) throw new IdempotencyKeyRaceError();
      const row = rows.find((r) => r.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      recordIdempotency({
        userId,
        key: idempotency.key,
        requestHash: idempotency.requestHash,
        resourceId: row.id,
      });
      return row;
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findByUserId(userId, opts) {
      return rows.filter((r) => r.userId === userId && !r.deletedAt).slice(0, opts.limit);
    },
    async softDelete(id) {
      const row = rows.find((r) => r.id === id)!;
      row.deletedAt = new Date();
      row.version += 1;
      return row;
    },
    async sumByWallets() {
      return [];
    },
    async sumExpenseByCategory() {
      return [];
    },
  };
}

function fakeIdempotencyKeyRepository(
  idempotencyRows: IdempotencyKey[],
): IIdempotencyKeyRepository {
  return {
    async findByUserAndKey(userId, key) {
      return idempotencyRows.find((k) => k.userId === userId && k.key === key) ?? null;
    },
  };
}

function fakeWalletRepository(seed: FinanceWallet[]): IFinanceWalletRepository {
  return {
    async findById(id) {
      return seed.find((w) => w.id === id) ?? null;
    },
  } as IFinanceWalletRepository;
}

function fakeCategoryRepository(seed: FinanceCategory[]): IFinanceCategoryRepository {
  return {
    async findById(id) {
      return seed.find((c) => c.id === id) ?? null;
    },
    async findByIds(ids) {
      return seed.filter((c) => ids.includes(c.id));
    },
  } as IFinanceCategoryRepository;
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

const wallet: FinanceWallet = {
  id: "wallet-1",
  userId: "user-1",
  name: "Bank",
  currency: "IRR",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
};

const category: FinanceCategory = {
  id: "category-1",
  userId: "user-1",
  name: "Groceries",
  type: "EXPENSE",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
};

function buildService(transactionRepo = fakeTransactionRepository()) {
  const service = new TransactionService(
    transactionRepo,
    fakeWalletRepository([wallet]),
    fakeCategoryRepository([category]),
    fakeIdempotencyKeyRepository(transactionRepo.idempotencyRows),
    fakeAuditLogRepository(),
  );
  return { service, transactionRepo };
}

const baseInput: CreateTransactionInput = {
  walletId: wallet.id,
  categoryId: category.id,
  type: "EXPENSE",
  amount: 250_000n,
  currency: "IRR",
  occurredAt: new Date("2024-05-01T00:00:00.000Z"),
  note: "lunch",
};

test("createTransaction rejects a walletId not owned by the caller", async () => {
  const { service } = buildService();
  await assert.rejects(
    () => service.createTransaction("user-1", { ...baseInput, walletId: "someone-elses-wallet" }),
    NotFoundError,
  );
});

test("createTransaction rejects a categoryId not owned by the caller", async () => {
  const { service } = buildService();
  await assert.rejects(
    () =>
      service.createTransaction("user-1", { ...baseInput, categoryId: "someone-elses-category" }),
    NotFoundError,
  );
});

test("createTransaction with the same Idempotency-Key and same body replays the original transaction", async () => {
  const { service, transactionRepo } = buildService();
  const first = await service.createTransaction("user-1", baseInput, "key-1");
  const second = await service.createTransaction("user-1", baseInput, "key-1");

  assert.equal(second.id, first.id);
  assert.equal(transactionRepo.rows.length, 1);
});

test("createTransaction with the same Idempotency-Key but a different body throws ConflictError", async () => {
  const { service, transactionRepo } = buildService();
  await service.createTransaction("user-1", baseInput, "key-1");

  await assert.rejects(
    () => service.createTransaction("user-1", { ...baseInput, amount: 999_000n }, "key-1"),
    ConflictError,
  );
  assert.equal(transactionRepo.rows.length, 1);
});

test("createTransaction with a different Idempotency-Key creates a new transaction", async () => {
  const { service, transactionRepo } = buildService();
  const first = await service.createTransaction("user-1", baseInput, "key-1");
  const second = await service.createTransaction("user-1", baseInput, "key-2");

  assert.notEqual(second.id, first.id);
  assert.equal(transactionRepo.rows.length, 2);
});

test("createTransaction recovers from a lost race by replaying the winner's transaction", async () => {
  const { service, transactionRepo } = buildService();
  // Simulate a concurrent request that commits between our findByUserAndKey
  // check and our own write: the winner's row already exists with the same
  // request hash our call would compute, so we should replay it rather than
  // surface the race as an error.
  const winnerRow = await transactionRepo.create({ userId: "user-1", ...baseInput });
  transactionRepo.armRace({
    key: "key-1",
    userId: "user-1",
    requestHash: hashCreateTransactionInput(baseInput),
    resourceId: winnerRow.id,
  });

  const result = await service.createTransaction("user-1", baseInput, "key-1");
  assert.equal(result.id, winnerRow.id);
  assert.equal(transactionRepo.rows.length, 1);
});

test("createTransaction surfaces a lost race as ConflictError when the winner's body differs", async () => {
  const { service, transactionRepo } = buildService();
  const winnerRow = await transactionRepo.create({ userId: "user-1", ...baseInput });
  transactionRepo.armRace({
    key: "key-1",
    userId: "user-1",
    requestHash: hashCreateTransactionInput({ ...baseInput, amount: 1n }),
    resourceId: winnerRow.id,
  });

  await assert.rejects(
    () => service.createTransaction("user-1", baseInput, "key-1"),
    ConflictError,
  );
});

test("updateTransaction rejects a transaction owned by a different user", async () => {
  const { service, transactionRepo } = buildService();
  const created = await transactionRepo.create({ userId: "user-1", ...baseInput });

  await assert.rejects(
    () => service.updateTransaction(created.id, "user-2", { amount: 1n }),
    NotFoundError,
  );
});

test("deleteTransaction soft-deletes so the transaction no longer appears in listTransactions", async () => {
  const { service } = buildService();
  const created = await service.createTransaction("user-1", baseInput);

  await service.deleteTransaction(created.id, "user-1");
  const results = await service.listTransactions("user-1", { limit: 20 });
  assert.equal(results.length, 0);
});
