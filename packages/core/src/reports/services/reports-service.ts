import type { ITaskRepository } from "@lifeos/db";
import type { DashboardService, DashboardResult } from "../../finance/services/dashboard-service";
import { jalaaliMonthRangeUtc } from "../../shared/jalali";

export interface DashboardReportResult {
  jalaliYear: number;
  jalaliMonth: number;
  finance: DashboardResult;
  tasks: { completed: number; created: number };
}

// Composes Finance's own DashboardService (own-module service, matching
// AgendaService's own-module CalendarEventService composition) + a raw
// cross-module Task repository read (matching AgendaService's ITaskRepository
// composition) — no Prisma model of its own, everything derived on read.
export class ReportsService {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly taskRepository: ITaskRepository,
  ) {}

  async getDashboardReport(
    userId: string,
    override?: { jalaliYear: number; jalaliMonth: number },
  ): Promise<DashboardReportResult> {
    const finance = await this.dashboardService.getDashboard(userId, override);
    // Derive the range from finance's own resolved year/month rather than
    // re-resolving "now" a second time, so the two never disagree by a few
    // milliseconds right at a Jalali month boundary.
    const range = jalaaliMonthRangeUtc(finance.jalaliYear, finance.jalaliMonth);
    const tasks = await this.taskRepository.findCompletionStatsInRange(userId, range);
    return { jalaliYear: finance.jalaliYear, jalaliMonth: finance.jalaliMonth, finance, tasks };
  }
}
