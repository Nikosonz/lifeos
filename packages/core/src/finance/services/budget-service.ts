import type {
  IFinanceBudgetRepository,
  IFinanceCategoryRepository,
  IFinanceTransactionRepository,
  IAuditLogRepository,
  FinanceBudget,
} from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";
import { jalaaliMonthRangeUtc } from "../../shared/jalali";
import { OwnedResourceCrud } from "../../shared/owned-resource-crud";

export interface BudgetWithSpending extends FinanceBudget {
  spent: bigint;
  remaining: bigint;
}

export class BudgetService {
  private readonly crud: OwnedResourceCrud<FinanceBudget, never, { limitAmount?: bigint }>;

  constructor(
    private readonly budgetRepository: IFinanceBudgetRepository,
    private readonly categoryRepository: IFinanceCategoryRepository,
    private readonly transactionRepository: IFinanceTransactionRepository,
    auditLogRepository: IAuditLogRepository,
  ) {
    this.crud = new OwnedResourceCrud(budgetRepository, auditLogRepository, {
      entityName: "Budget",
      actionPrefix: "finance.budget",
    });
  }

  // Can't use crud.create — a budget's "create" is an upsert keyed on
  // (userId, categoryId, jalaliYear, jalaliMonth), and the ownership check
  // that matters here is the *category's*, not the budget's (it may not
  // exist yet). See docs/decisions/0010-owned-resource-crud.md.
  async createOrUpdateBudget(
    userId: string,
    data: {
      categoryId: string;
      jalaliYear: number;
      jalaliMonth: number;
      limitAmount: bigint;
      currency: string;
    },
  ): Promise<FinanceBudget> {
    const category = await this.categoryRepository.findById(data.categoryId);
    if (!category || category.userId !== userId || category.deletedAt) {
      throw new NotFoundError("Category");
    }
    const budget = await this.budgetRepository.upsert({ userId, ...data });
    await this.crud.audit(userId, "upserted", budget.id);
    return budget;
  }

  async listWithSpending(
    userId: string,
    jalaliYear: number,
    jalaliMonth: number,
  ): Promise<BudgetWithSpending[]> {
    const budgets = await this.budgetRepository.findByUserAndPeriod(
      userId,
      jalaliYear,
      jalaliMonth,
    );
    if (budgets.length === 0) return [];
    const range = jalaaliMonthRangeUtc(jalaliYear, jalaliMonth);
    const sums = await this.transactionRepository.sumExpenseByCategory(userId, range);
    const spentByCategory = new Map(sums.map((s) => [s.categoryId, s.sum]));
    return budgets.map((budget) => {
      const spent = spentByCategory.get(budget.categoryId) ?? 0n;
      return { ...budget, spent, remaining: budget.limitAmount - spent };
    });
  }

  getBudget(id: string, userId: string): Promise<FinanceBudget> {
    return this.crud.getOwned(id, userId);
  }

  // Single-budget variant of listWithSpending, for endpoints that return
  // one budget (create/update/get) rather than a whole period's list.
  async getBudgetWithSpending(id: string, userId: string): Promise<BudgetWithSpending> {
    const budget = await this.getBudget(id, userId);
    const range = jalaaliMonthRangeUtc(budget.jalaliYear, budget.jalaliMonth);
    const sums = await this.transactionRepository.sumExpenseByCategory(userId, range);
    const spent = sums.find((s) => s.categoryId === budget.categoryId)?.sum ?? 0n;
    return { ...budget, spent, remaining: budget.limitAmount - spent };
  }

  updateBudget(
    id: string,
    userId: string,
    data: { limitAmount?: bigint },
    expectedVersion?: number,
  ): Promise<FinanceBudget> {
    return this.crud.update(id, userId, data, expectedVersion);
  }

  deleteBudget(id: string, userId: string, expectedVersion?: number): Promise<void> {
    return this.crud.delete(id, userId, expectedVersion);
  }
}
