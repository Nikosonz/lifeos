import { prisma, HabitRepository, HabitCheckInRepository, AuditLogRepository } from "@lifeos/db";
import { HabitService } from "./services/habit-service";

const habitRepository = new HabitRepository(prisma);
const habitCheckInRepository = new HabitCheckInRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);

export const habitService = new HabitService(
  habitRepository,
  habitCheckInRepository,
  auditLogRepository,
);
