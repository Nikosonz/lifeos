import { DashboardQuery, DashboardResponse } from "@lifeos/contracts";
import { dashboardService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";

export const GET = defineRoute(
  { query: DashboardQuery, response: DashboardResponse },
  async ({ userId, query }) => {
    // Only apply an override when both year and month are given together —
    // a lone jalaliYear or jalaliMonth query param is treated as if neither
    // were supplied, defaulting to the current Tehran-local Jalali month.
    const override =
      query.jalaliYear !== undefined && query.jalaliMonth !== undefined
        ? { jalaliYear: query.jalaliYear, jalaliMonth: query.jalaliMonth }
        : undefined;
    const dashboard = await dashboardService.getDashboard(userId, override);
    return {
      jalaliYear: dashboard.jalaliYear,
      jalaliMonth: dashboard.jalaliMonth,
      totalBalance: dashboard.totalBalance.toString(),
      wallets: dashboard.wallets.map((w) => ({
        walletId: w.walletId,
        name: w.name,
        balance: w.balance.toString(),
      })),
      spendingByCategory: dashboard.spendingByCategory.map((s) => ({
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        spent: s.spent.toString(),
      })),
      budgets: dashboard.budgets.map((b) => ({
        categoryId: b.categoryId,
        categoryName: b.categoryName,
        limitAmount: b.limitAmount.toString(),
        spent: b.spent.toString(),
        remaining: b.remaining.toString(),
      })),
    };
  },
);
