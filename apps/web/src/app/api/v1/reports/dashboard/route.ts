import { ReportsDashboardQuery } from "@lifeos/contracts";
import { reportsService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const query = ReportsDashboardQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const override =
    query.jalaliYear !== undefined && query.jalaliMonth !== undefined
      ? { jalaliYear: query.jalaliYear, jalaliMonth: query.jalaliMonth }
      : undefined;
  const report = await reportsService.getDashboardReport(userId, override);
  return {
    jalaliYear: report.jalaliYear,
    jalaliMonth: report.jalaliMonth,
    finance: {
      jalaliYear: report.finance.jalaliYear,
      jalaliMonth: report.finance.jalaliMonth,
      totalBalance: report.finance.totalBalance.toString(),
      wallets: report.finance.wallets.map((w) => ({
        walletId: w.walletId,
        name: w.name,
        balance: w.balance.toString(),
      })),
      spendingByCategory: report.finance.spendingByCategory.map((s) => ({
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        spent: s.spent.toString(),
      })),
      budgets: report.finance.budgets.map((b) => ({
        categoryId: b.categoryId,
        categoryName: b.categoryName,
        limitAmount: b.limitAmount.toString(),
        spent: b.spent.toString(),
        remaining: b.remaining.toString(),
      })),
    },
    tasks: report.tasks,
  };
});
