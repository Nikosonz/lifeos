import { prisma, NotificationRepository, AuditLogRepository } from "@lifeos/db";
import { NotificationService } from "./services/notification-service";

// Composition root for the notifications module — backs this module's own
// routes. Other modules that trigger notifications (e.g. Finance) wire their
// own independent NotificationService instance in their own container rather
// than importing this singleton — see finance/container.ts and ADR-0009.
const notificationRepository = new NotificationRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);

export const notificationService = new NotificationService(
  notificationRepository,
  auditLogRepository,
);
