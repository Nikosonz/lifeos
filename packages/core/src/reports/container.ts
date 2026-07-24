import { prisma, TaskRepository } from "@lifeos/db";
import { dashboardService } from "../finance/container";
import { ReportsService } from "./services/reports-service";

// Composition root for the reports module — the only file in this module
// that imports @lifeos/db.
//
// dashboardService is reused as the singleton Finance's own container
// already built, not re-wired from scratch here — see ADR-0009's container
// sharing policy (a whole composed multi-repository service with no
// per-call state reuses the sibling's singleton; TaskRepository below still
// gets its own instance, since that rule is about cheap stateless
// repositories).
const taskRepository = new TaskRepository(prisma);

export const reportsService = new ReportsService(dashboardService, taskRepository);
