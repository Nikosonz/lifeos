import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  IFinanceWalletRepository,
  IFinanceTransactionRepository,
  IAuditLogRepository,
  FinanceWallet,
  FinanceTransactionType,
} from "@lifeos/db";
import { WalletService } from "../src/finance/services/wallet-service";
import { NotFoundError } from "../src/errors/app-error";

function fakeWalletRepository(): IFinanceWalletRepository & { rows: FinanceWallet[] } {
  const rows: FinanceWallet[] = [];
  return {
    rows,
    async create(data) {
      const row: FinanceWallet = {
        id: `wallet-${rows.length}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        ...data,
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((w) => w.id === id) ?? null;
    },
    async findByUserId(userId) {
      return rows.filter((w) => w.userId === userId && !w.deletedAt);
    },
    async update(id, data) {
      const row = rows.find((w) => w.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    async softDelete(id) {
      const row = rows.find((w) => w.id === id)!;
      row.deletedAt = new Date();
      row.version += 1;
      return row;
    },
  };
}

// Only sumByWallets is exercised by WalletService — the fake's backing
// array is a plain list of { walletId, type, amount } rows, summed the
// same way the real groupBy aggregate would.
function fakeTransactionRepository(
  seed: Array<{ walletId: string; type: FinanceTransactionType; amount: bigint }>,
): Pick<IFinanceTransactionRepository, "sumByWallets"> {
  return {
    async sumByWallets(walletIds) {
      const byKey = new Map<string, bigint>();
      for (const row of seed) {
        if (!walletIds.includes(row.walletId)) continue;
        const key = `${row.walletId}:${row.type}`;
        byKey.set(key, (byKey.get(key) ?? 0n) + row.amount);
      }
      return Array.from(byKey.entries()).map(([key, sum]) => {
        const [walletId, type] = key.split(":") as [string, FinanceTransactionType];
        return { walletId, type, sum };
      });
    },
  };
}

function fakeAuditLogRepository(): IAuditLogRepository & { records: Array<{ action: string }> } {
  const records: Array<{ action: string }> = [];
  return {
    records,
    async record(data) {
      records.push(data);
      return {
        id: `audit-${records.length}`,
        createdAt: new Date(),
        userId: data.userId ?? null,
        action: data.action,
        metadata: null,
      };
    },
  };
}

test("listWithBalances derives balance from a mix of income and expense transactions", async () => {
  const walletRepo = fakeWalletRepository();
  const wallet = await walletRepo.create({ userId: "user-1", name: "Bank", currency: "IRR" });
  const transactionRepo = fakeTransactionRepository([
    { walletId: wallet.id, type: "INCOME", amount: 5_000_000n },
    { walletId: wallet.id, type: "EXPENSE", amount: 1_200_000n },
    { walletId: wallet.id, type: "EXPENSE", amount: 300_000n },
  ]);
  const service = new WalletService(
    walletRepo,
    transactionRepo as IFinanceTransactionRepository,
    fakeAuditLogRepository(),
  );

  const [result] = await service.listWithBalances("user-1");
  assert.equal(result?.balance, 3_500_000n);
});

test("getWallet throws NotFoundError for a wallet owned by a different user", async () => {
  const walletRepo = fakeWalletRepository();
  const wallet = await walletRepo.create({ userId: "user-1", name: "Bank", currency: "IRR" });
  const service = new WalletService(
    walletRepo,
    fakeTransactionRepository([]) as IFinanceTransactionRepository,
    fakeAuditLogRepository(),
  );

  await assert.rejects(() => service.getWallet(wallet.id, "user-2"), NotFoundError);
});

test("a soft-deleted wallet is excluded from listWithBalances", async () => {
  const walletRepo = fakeWalletRepository();
  const wallet = await walletRepo.create({ userId: "user-1", name: "Bank", currency: "IRR" });
  await walletRepo.softDelete(wallet.id);
  const service = new WalletService(
    walletRepo,
    fakeTransactionRepository([]) as IFinanceTransactionRepository,
    fakeAuditLogRepository(),
  );

  const results = await service.listWithBalances("user-1");
  assert.equal(results.length, 0);
});
