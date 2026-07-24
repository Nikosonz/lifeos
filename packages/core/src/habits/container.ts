import { prisma, HabitRepository, HabitCheckInRepository, AuditLogRepository } from "@lifeos/db";
import { HabitService } from "./services/habit-service";

// Composition root for the habits module — the only file in this module
// that imports @lifeos/db. See ADR-0009 for this module's sharing policy.
const habitRepository = new HabitRepository(prisma);
const habitCheckInRepository = new HabitCheckInRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);

export const habitService = new HabitService(
  habitRepository,
  habitCheckInRepository,
  auditLogRepository,
);
