import { ReportsDashboardResponse } from "@lifeos/contracts";
import { apiFetch } from "./api-client";

export const reportsApi = {
  getDashboard: (override?: { jalaliYear: number; jalaliMonth: number }) =>
    apiFetch("/api/v1/reports/dashboard", {
      ...(override ? { query: override } : {}),
      schema: ReportsDashboardResponse,
    }),
};
