import { prisma, TaskRepository } from "@lifeos/db";
import { dashboardService } from "../finance/container";
import { ReportsService } from "./services/reports-service";

// Composition root for the reports module — the only file in this module
// that imports @lifeos/db.
//
// dashboardService is reused as the singleton Finance's own container
// already built, not re-wired from scratch here. That's a deliberate
// departure from "every module wires its own instance independently"
// (which Calendar's TaskRepository wiring below still follows): that
// precedent is about cheap, stateless repositories. DashboardService is a
// whole composed service with its own multi-repository dependency graph —
// duplicating that graph here would be pure duplication with real drift
// risk if Finance's composition ever changes, for zero isolation benefit
// (DashboardService retains no per-call state, so sharing the singleton is
// behaviorally identical to a second instance).
const taskRepository = new TaskRepository(prisma);

export const reportsService = new ReportsService(dashboardService, taskRepository);
