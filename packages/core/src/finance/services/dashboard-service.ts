import type { IFinanceTransactionRepository, IFinanceCategoryRepository } from "@lifeos/db";
import { getJalaliYearMonthForInstant, jalaaliMonthRangeUtc } from "../../shared/jalali";
import type { WalletService } from "./wallet-service";
import type { BudgetService } from "./budget-service";

export interface DashboardResult {
  jalaliYear: number;
  jalaliMonth: number;
  totalBalance: bigint;
  wallets: Array<{ walletId: string; name: string; balance: bigint }>;
  spendingByCategory: Array<{ categoryId: string; categoryName: string; spent: bigint }>;
  budgets: Array<{
    categoryId: string;
    categoryName: string;
    limitAmount: bigint;
    spent: bigint;
    remaining: bigint;
  }>;
}

// Composes WalletService + BudgetService + direct repository reads — the
// one place all of Finance's pieces get aggregated together for a single
// user-facing view. Never do this aggregation in a route handler.
export class DashboardService {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionRepository: IFinanceTransactionRepository,
    private readonly categoryRepository: IFinanceCategoryRepository,
    private readonly budgetService: BudgetService,
  ) {}

  async getDashboard(
    userId: string,
    override?: { jalaliYear: number; jalaliMonth: number },
  ): Promise<DashboardResult> {
    const { year: jalaliYear, month: jalaliMonth } = override
      ? { year: override.jalaliYear, month: override.jalaliMonth }
      : getJalaliYearMonthForInstant(new Date());

    const wallets = await this.walletService.listWithBalances(userId);
    const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0n);

    const range = jalaaliMonthRangeUtc(jalaliYear, jalaliMonth);
    const spendSums = await this.transactionRepository.sumExpenseByCategory(userId, range);
    const spendingByCategory = await this.withCategoryNames(
      spendSums.map((s) => ({ categoryId: s.categoryId, spent: s.sum })),
    );

    const budgetsWithSpending = await this.budgetService.listWithSpending(
      userId,
      jalaliYear,
      jalaliMonth,
    );
    const budgetsWithNames = await this.withCategoryNames(
      budgetsWithSpending.map((b) => ({
        categoryId: b.categoryId,
        limitAmount: b.limitAmount,
        spent: b.spent,
        remaining: b.remaining,
      })),
    );

    return {
      jalaliYear,
      jalaliMonth,
      totalBalance,
      wallets: wallets.map((w) => ({ walletId: w.id, name: w.name, balance: w.balance })),
      spendingByCategory,
      budgets: budgetsWithNames,
    };
  }

  private async withCategoryNames<T extends { categoryId: string }>(
    rows: T[],
  ): Promise<Array<T & { categoryName: string }>> {
    if (rows.length === 0) return [];
    const categories = await this.categoryRepository.findByIds(rows.map((r) => r.categoryId));
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    return rows.map((row) => ({ ...row, categoryName: nameById.get(row.categoryId) ?? "Unknown" }));
  }
}
