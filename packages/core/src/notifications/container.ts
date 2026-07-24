import { prisma, NotificationRepository, AuditLogRepository } from "@lifeos/db";
import { NotificationService } from "./services/notification-service";

// Composition root for the notifications module — backs this module's own
// routes. Other modules that trigger notifications (e.g. Finance) wire their
// own independent instance rather than importing this singleton — see
// ADR-0009's container sharing policy.
const notificationRepository = new NotificationRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);

export const notificationService = new NotificationService(
  notificationRepository,
  auditLogRepository,
);
