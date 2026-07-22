import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  IFinanceBudgetRepository,
  IFinanceCategoryRepository,
  IFinanceTransactionRepository,
  IAuditLogRepository,
  FinanceBudget,
  FinanceCategory,
} from "@lifeos/db";
import { BudgetService } from "../src/finance/services/budget-service";
import { NotFoundError } from "../src/errors/app-error";

function fakeBudgetRepository(): IFinanceBudgetRepository & { rows: FinanceBudget[] } {
  const rows: FinanceBudget[] = [];
  return {
    rows,
    async upsert(data) {
      const existing = rows.find(
        (b) =>
          b.userId === data.userId &&
          b.categoryId === data.categoryId &&
          b.jalaliYear === data.jalaliYear &&
          b.jalaliMonth === data.jalaliMonth,
      );
      if (existing) {
        existing.limitAmount = data.limitAmount;
        existing.currency = data.currency;
        existing.version += 1;
        return existing;
      }
      const row: FinanceBudget = {
        id: `budget-${rows.length}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        ...data,
      };
      rows.push(row);
      return row;
    },
    async findByUserAndPeriod(userId, jalaliYear, jalaliMonth) {
      return rows.filter(
        (b) =>
          b.userId === userId &&
          b.jalaliYear === jalaliYear &&
          b.jalaliMonth === jalaliMonth &&
          !b.deletedAt,
      );
    },
    async findById(id) {
      return rows.find((b) => b.id === id) ?? null;
    },
    async update(id, data) {
      const row = rows.find((b) => b.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    async softDelete(id) {
      const row = rows.find((b) => b.id === id)!;
      row.deletedAt = new Date();
      row.version += 1;
      return row;
    },
  };
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

function fakeTransactionRepository(
  spentByCategory: Record<string, bigint>,
): IFinanceTransactionRepository {
  return {
    async sumExpenseByCategory() {
      return Object.entries(spentByCategory).map(([categoryId, sum]) => ({ categoryId, sum }));
    },
  } as unknown as IFinanceTransactionRepository;
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

test("createOrUpdateBudget upserts: the same category+period twice produces one row with the new limit", async () => {
  const budgetRepo = fakeBudgetRepository();
  const service = new BudgetService(
    budgetRepo,
    fakeCategoryRepository([category]),
    fakeTransactionRepository({}),
    fakeAuditLogRepository(),
  );

  await service.createOrUpdateBudget("user-1", {
    categoryId: category.id,
    jalaliYear: 1403,
    jalaliMonth: 3,
    limitAmount: 3_000_000n,
    currency: "IRR",
  });
  await service.createOrUpdateBudget("user-1", {
    categoryId: category.id,
    jalaliYear: 1403,
    jalaliMonth: 3,
    limitAmount: 4_000_000n,
    currency: "IRR",
  });

  assert.equal(budgetRepo.rows.length, 1);
  assert.equal(budgetRepo.rows[0]?.limitAmount, 4_000_000n);
});

test("createOrUpdateBudget rejects a categoryId not owned by the caller", async () => {
  const service = new BudgetService(
    fakeBudgetRepository(),
    fakeCategoryRepository([category]),
    fakeTransactionRepository({}),
    fakeAuditLogRepository(),
  );

  await assert.rejects(
    () =>
      service.createOrUpdateBudget("user-2", {
        categoryId: category.id,
        jalaliYear: 1403,
        jalaliMonth: 3,
        limitAmount: 1_000_000n,
        currency: "IRR",
      }),
    NotFoundError,
  );
});

// Cross-user rejection on updateBudget/deleteBudget is OwnedResourceCrud's
// own generic behavior, tested once in owned-resource-crud.test.ts — this
// is a wiring smoke test confirming BudgetService's own methods actually
// reach it (updateBudget/deleteBudget were previously untested here
// entirely; see ADR-0010).
test("updateBudget and deleteBudget work via BudgetService, and reject a different user", async () => {
  const service = new BudgetService(
    fakeBudgetRepository(),
    fakeCategoryRepository([category]),
    fakeTransactionRepository({}),
    fakeAuditLogRepository(),
  );
  const budget = await service.createOrUpdateBudget("user-1", {
    categoryId: category.id,
    jalaliYear: 1403,
    jalaliMonth: 3,
    limitAmount: 3_000_000n,
    currency: "IRR",
  });

  await assert.rejects(
    () => service.updateBudget(budget.id, "user-2", { limitAmount: 1n }),
    NotFoundError,
  );

  const updated = await service.updateBudget(budget.id, "user-1", { limitAmount: 5_000_000n });
  assert.equal(updated.limitAmount, 5_000_000n);

  await service.deleteBudget(budget.id, "user-1");
  await assert.rejects(() => service.getBudget(budget.id, "user-1"), NotFoundError);
});

test("listWithSpending joins each budget with that category's spend for the period", async () => {
  const budgetRepo = fakeBudgetRepository();
  const service = new BudgetService(
    budgetRepo,
    fakeCategoryRepository([category]),
    fakeTransactionRepository({ [category.id]: 1_200_000n }),
    fakeAuditLogRepository(),
  );
  await service.createOrUpdateBudget("user-1", {
    categoryId: category.id,
    jalaliYear: 1403,
    jalaliMonth: 3,
    limitAmount: 3_000_000n,
    currency: "IRR",
  });

  const [result] = await service.listWithSpending("user-1", 1403, 3);
  assert.equal(result?.spent, 1_200_000n);
  assert.equal(result?.remaining, 1_800_000n);
});
