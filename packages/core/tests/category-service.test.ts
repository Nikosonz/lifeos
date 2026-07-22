import { test } from "node:test";
import assert from "node:assert/strict";
import type { IFinanceCategoryRepository, IAuditLogRepository, FinanceCategory } from "@lifeos/db";
import { CategoryService } from "../src/finance/services/category-service";

function fakeCategoryRepository(): IFinanceCategoryRepository & { rows: FinanceCategory[] } {
  const rows: FinanceCategory[] = [];
  return {
    rows,
    async create(data) {
      const row: FinanceCategory = {
        id: `category-${rows.length}`,
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
      return rows.find((c) => c.id === id) ?? null;
    },
    async findByUserId(userId) {
      return rows.filter((c) => c.userId === userId && !c.deletedAt);
    },
    async findByIds(ids) {
      return rows.filter((c) => ids.includes(c.id));
    },
    async update(id, data) {
      const row = rows.find((c) => c.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    async softDelete(id) {
      const row = rows.find((c) => c.id === id)!;
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

test("createCategory then listCategories returns the created category for its owner", async () => {
  const service = new CategoryService(fakeCategoryRepository(), fakeAuditLogRepository());
  await service.createCategory("user-1", { name: "Groceries", type: "EXPENSE" });

  const categories = await service.listCategories("user-1");
  assert.equal(categories.length, 1);
  assert.equal(categories[0]?.name, "Groceries");
});

// Cross-user rejection on update/delete is OwnedResourceCrud's own generic
// behavior, tested once in owned-resource-crud.test.ts — this is a wiring
// smoke test confirming CategoryService's updateCategory actually reaches
// it and applies the change for the real owner (see ADR-0010).
test("updateCategory changes the name for its real owner", async () => {
  const service = new CategoryService(fakeCategoryRepository(), fakeAuditLogRepository());
  const category = await service.createCategory("user-1", { name: "Groceries", type: "EXPENSE" });

  const updated = await service.updateCategory(category.id, "user-1", { name: "Household" });

  assert.equal(updated.name, "Household");
});

test("deleteCategory soft-deletes and removes the category from listCategories", async () => {
  const service = new CategoryService(fakeCategoryRepository(), fakeAuditLogRepository());
  const category = await service.createCategory("user-1", { name: "Groceries", type: "EXPENSE" });

  await service.deleteCategory(category.id, "user-1");
  const categories = await service.listCategories("user-1");
  assert.equal(categories.length, 0);
});
