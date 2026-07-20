import { z } from "zod";
import { DashboardResponse } from "../finance/schemas";

// Jalali month only, same optional-override convention as Finance's
// DashboardQuery — a Jalali week (Saturday-start) has no existing range
// helper and isn't built speculatively for this pass.
export const ReportsDashboardQuery = z.object({
  jalaliYear: z.coerce.number().int().optional(),
  jalaliMonth: z.coerce.number().int().min(1).max(12).optional(),
});
export type ReportsDashboardQuery = z.infer<typeof ReportsDashboardQuery>;

export const ReportsDashboardResponse = z.object({
  jalaliYear: z.number().int(),
  jalaliMonth: z.number().int(),
  finance: DashboardResponse,
  tasks: z.object({
    completed: z.number().int(),
    created: z.number().int(),
  }),
});
export type ReportsDashboardResponse = z.infer<typeof ReportsDashboardResponse>;
