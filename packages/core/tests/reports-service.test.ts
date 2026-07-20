import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  IFinanceWalletRepository,
  IFinanceTransactionRepository,
  IFinanceCategoryRepository,
  IFinanceBudgetRepository,
  IAuditLogRepository,
  ITaskRepository,
  FinanceWallet,
  FinanceCategory,
} from "@lifeos/db";
import { WalletService } from "../src/finance/services/wallet-service";
import { BudgetService } from "../src/finance/services/budget-service";
import { DashboardService } from "../src/finance/services/dashboard-service";
import { ReportsService } from "../src/reports/services/reports-service";
import { jalaaliMonthRangeUtc } from "../src/shared/jalali";

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

function fakeTransactionRepository(): IFinanceTransactionRepository {
  return {
    async sumByWallets() {
      return [{ walletId: walletA.id, type: "INCOME", sum: 5_000_000n }];
    },
    async sumExpenseByCategory() {
      return [{ categoryId: groceries.id, sum: 1_200_000n }];
    },
  } as unknown as IFinanceTransactionRepository;
}

function fakeCategoryRepository(): IFinanceCategoryRepository {
  return {
    async findByIds(ids) {
      return [groceries].filter((c) => ids.includes(c.id));
    },
  } as IFinanceCategoryRepository;
}

function fakeBudgetRepository(): IFinanceBudgetRepository {
  return {
    async findByUserAndPeriod() {
      return [];
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

// Records the range it was called with so tests can prove ReportsService
// derives it from DashboardService's own resolved Jalali month rather than
// re-resolving "now" a second time.
function fakeTaskRepository(
  completedAt: Date[],
): ITaskRepository & { calledWithRange?: { gte: Date; lt: Date } } {
  const state: { calledWithRange?: { gte: Date; lt: Date } } = {};
  return {
    get calledWithRange() {
      return state.calledWithRange;
    },
    async findCompletionStatsInRange(_userId: string, range: { gte: Date; lt: Date }) {
      state.calledWithRange = range;
      const completed = completedAt.filter(
        (d) => d.getTime() >= range.gte.getTime() && d.getTime() < range.lt.getTime(),
      ).length;
      return { completed, created: completed + 1 };
    },
  } as unknown as ITaskRepository & { calledWithRange?: { gte: Date; lt: Date } };
}

function buildDashboardService() {
  const categoryRepo = fakeCategoryRepository();
  const transactionRepo = fakeTransactionRepository();
  const auditRepo = fakeAuditLogRepository();
  const walletService = new WalletService(fakeWalletRepository(), transactionRepo, auditRepo);
  const budgetService = new BudgetService(
    fakeBudgetRepository(),
    categoryRepo,
    transactionRepo,
    auditRepo,
  );
  return new DashboardService(walletService, transactionRepo, categoryRepo, budgetService);
}

test("getDashboardReport composes finance dashboard data with task completion stats", async () => {
  const dashboardService = buildDashboardService();
  const taskRepo = fakeTaskRepository([new Date("2024-12-25T00:00:00.000Z")]);
  const reportsService = new ReportsService(dashboardService, taskRepo);

  const report = await reportsService.getDashboardReport("user-1", {
    jalaliYear: 1403,
    jalaliMonth: 10,
  });

  assert.equal(report.jalaliYear, 1403);
  assert.equal(report.jalaliMonth, 10);
  assert.equal(report.finance.totalBalance, 5_000_000n);
  assert.equal(report.tasks.completed, 1);
});

test("getDashboardReport derives the task range from finance's own resolved Jalali month", async () => {
  const dashboardService = buildDashboardService();
  const taskRepo = fakeTaskRepository([]);
  const reportsService = new ReportsService(dashboardService, taskRepo);

  await reportsService.getDashboardReport("user-1", { jalaliYear: 1403, jalaliMonth: 10 });

  const expectedRange = jalaaliMonthRangeUtc(1403, 10);
  assert.equal(taskRepo.calledWithRange?.gte.getTime(), expectedRange.gte.getTime());
  assert.equal(taskRepo.calledWithRange?.lt.getTime(), expectedRange.lt.getTime());
});

test("getDashboardReport excludes a task completed one millisecond before the resolved month", async () => {
  const dashboardService = buildDashboardService();
  // 1403/10 range: [2024-12-20T20:30:00.000Z, 2025-01-19T20:30:00.000Z)
  const justBefore = new Date("2024-12-20T20:29:59.999Z");
  const taskRepo = fakeTaskRepository([justBefore]);
  const reportsService = new ReportsService(dashboardService, taskRepo);

  const report = await reportsService.getDashboardReport("user-1", {
    jalaliYear: 1403,
    jalaliMonth: 10,
  });

  assert.equal(report.tasks.completed, 0);
});

test("getDashboardReport includes a task completed exactly at the resolved month's start", async () => {
  const dashboardService = buildDashboardService();
  const atStart = new Date("2024-12-20T20:30:00.000Z");
  const taskRepo = fakeTaskRepository([atStart]);
  const reportsService = new ReportsService(dashboardService, taskRepo);

  const report = await reportsService.getDashboardReport("user-1", {
    jalaliYear: 1403,
    jalaliMonth: 10,
  });

  assert.equal(report.tasks.completed, 1);
});
