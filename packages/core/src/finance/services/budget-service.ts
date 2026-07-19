import type {
  IFinanceBudgetRepository,
  IFinanceCategoryRepository,
  IFinanceTransactionRepository,
  IAuditLogRepository,
  FinanceBudget,
} from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";
import { jalaaliMonthRangeUtc } from "../../shared/jalali";

export interface BudgetWithSpending extends FinanceBudget {
  spent: bigint;
  remaining: bigint;
}

export class BudgetService {
  constructor(
    private readonly budgetRepository: IFinanceBudgetRepository,
    private readonly categoryRepository: IFinanceCategoryRepository,
    private readonly transactionRepository: IFinanceTransactionRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

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
    await this.auditLogRepository.record({
      userId,
      action: "finance.budget.upserted",
      metadata: { budgetId: budget.id },
    });
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

  async getBudget(id: string, userId: string): Promise<FinanceBudget> {
    const budget = await this.budgetRepository.findById(id);
    if (!budget || budget.userId !== userId || budget.deletedAt) throw new NotFoundError("Budget");
    return budget;
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

  async updateBudget(
    id: string,
    userId: string,
    data: { limitAmount?: bigint },
  ): Promise<FinanceBudget> {
    await this.getBudget(id, userId);
    const updated = await this.budgetRepository.update(id, data);
    await this.auditLogRepository.record({
      userId,
      action: "finance.budget.updated",
      metadata: { budgetId: id },
    });
    return updated;
  }

  async deleteBudget(id: string, userId: string): Promise<void> {
    await this.getBudget(id, userId);
    await this.budgetRepository.softDelete(id);
    await this.auditLogRepository.record({
      userId,
      action: "finance.budget.deleted",
      metadata: { budgetId: id },
    });
  }
}
