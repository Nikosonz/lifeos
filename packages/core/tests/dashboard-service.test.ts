import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  IFinanceWalletRepository,
  IFinanceTransactionRepository,
  IFinanceCategoryRepository,
  IFinanceBudgetRepository,
  IAuditLogRepository,
  FinanceWallet,
  FinanceCategory,
  FinanceTransactionType,
} from "@lifeos/db";
import { WalletService } from "../src/finance/services/wallet-service";
import { BudgetService } from "../src/finance/services/budget-service";
import { DashboardService } from "../src/finance/services/dashboard-service";

const walletA: FinanceWallet = {
  id: "wallet-a",
  userId: "user-1",
  name: "Bank Melli",
  currency: "IRR",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
};

const groceries: FinanceCategory = {
  id: "category-groceries",
  userId: "user-1",
  name: "Groceries",
  type: "EXPENSE",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
};

function fakeWalletRepository(): IFinanceWalletRepository {
  return {
    async findByUserId() {
      return [walletA];
    },
  } as unknown as IFinanceWalletRepository;
}

// sumExpenseByCategory actually respects the passed range (unlike the
// simpler per-service test fakes) so this test can prove DashboardService
// resolves the correct Jalali-month boundary and excludes transactions
// just outside it — the boundary math itself is proven separately in
// jalali.test.ts; this only proves DashboardService wires it through.
function fakeTransactionRepository(
  walletSums: Array<{ walletId: string; type: FinanceTransactionType; sum: bigint }>,
  transactions: Array<{ categoryId: string; occurredAt: Date; amount: bigint }>,
): IFinanceTransactionRepository {
  return {
    async sumByWallets(walletIds) {
      return walletSums.filter((s) => walletIds.includes(s.walletId));
    },
    async sumExpenseByCategory(_userId, range) {
      const byCategory = new Map<string, bigint>();
      for (const tx of transactions) {
        if (tx.occurredAt.getTime() < range.gte.getTime()) continue;
        if (tx.occurredAt.getTime() >= range.lt.getTime()) continue;
        byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0n) + tx.amount);
      }
      return Array.from(byCategory.entries()).map(([categoryId, sum]) => ({ categoryId, sum }));
    },
  } as IFinanceTransactionRepository;
}

function fakeCategoryRepository(): IFinanceCategoryRepository {
  return {
    async findByIds(ids) {
      return [groceries].filter((c) => ids.includes(c.id));
    },
  } as IFinanceCategoryRepository;
}

function fakeBudgetRepository(limitAmount: bigint): IFinanceBudgetRepository {
  return {
    async findByUserAndPeriod() {
      return [
        {
          id: "budget-1",
          userId: "user-1",
          categoryId: groceries.id,
          jalaliYear: 1403,
          jalaliMonth: 10,
          limitAmount,
          currency: "IRR",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          version: 1,
        },
      ];
    },
  } as unknown as IFinanceBudgetRepository;
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

test("getDashboard computes total balance, spending by category, and budget remaining for the requested Jalali month", async () => {
  // 1403/10 range (verified against jalaali-js directly, see jalali.test.ts):
  // [2024-12-20T20:30:00.000Z, 2025-01-19T20:30:00.000Z)
  const insideMonth = new Date("2024-12-25T00:00:00.000Z");
  const walletRepo = fakeWalletRepository();
  const transactionRepo = fakeTransactionRepository(
    [{ walletId: walletA.id, type: "INCOME", sum: 5_000_000n }],
    [{ categoryId: groceries.id, occurredAt: insideMonth, amount: 1_200_000n }],
  );
  const categoryRepo = fakeCategoryRepository();
  const auditRepo = fakeAuditLogRepository();

  const walletService = new WalletService(walletRepo, transactionRepo, auditRepo);
  const budgetService = new BudgetService(
    fakeBudgetRepository(3_000_000n),
    categoryRepo,
    transactionRepo,
    auditRepo,
  );
  const dashboardService = new DashboardService(
    walletService,
    transactionRepo,
    categoryRepo,
    budgetService,
  );

  const dashboard = await dashboardService.getDashboard("user-1", {
    jalaliYear: 1403,
    jalaliMonth: 10,
  });

  assert.equal(dashboard.totalBalance, 5_000_000n);
  assert.equal(dashboard.wallets[0]?.balance, 5_000_000n);
  assert.equal(dashboard.spendingByCategory[0]?.categoryId, groceries.id);
  assert.equal(dashboard.spendingByCategory[0]?.categoryName, "Groceries");
  assert.equal(dashboard.spendingByCategory[0]?.spent, 1_200_000n);
  assert.equal(dashboard.budgets[0]?.remaining, 1_800_000n);
});

test("getDashboard excludes a transaction that falls just outside the resolved Jalali month", async () => {
  const justBeforeRange = new Date("2024-12-20T20:29:59.999Z");
  const transactionRepo = fakeTransactionRepository(
    [],
    [{ categoryId: groceries.id, occurredAt: justBeforeRange, amount: 1_200_000n }],
  );
  const categoryRepo = fakeCategoryRepository();
  const auditRepo = fakeAuditLogRepository();
  const walletService = new WalletService(fakeWalletRepository(), transactionRepo, auditRepo);
  const budgetService = new BudgetService(
    fakeBudgetRepository(3_000_000n),
    categoryRepo,
    transactionRepo,
    auditRepo,
  );
  const dashboardService = new DashboardService(
    walletService,
    transactionRepo,
    categoryRepo,
    budgetService,
  );

  const dashboard = await dashboardService.getDashboard("user-1", {
    jalaliYear: 1403,
    jalaliMonth: 10,
  });

  assert.equal(dashboard.spendingByCategory.length, 0);
  assert.equal(dashboard.budgets[0]?.spent, 0n);
  assert.equal(dashboard.budgets[0]?.remaining, 3_000_000n);
});
