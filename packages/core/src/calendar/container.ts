import { prisma, CalendarEventRepository, TaskRepository, AuditLogRepository } from "@lifeos/db";
import { CalendarEventService } from "./services/calendar-event-service";
import { AgendaService } from "./services/agenda-service";

// Composition root for the calendar module — the only file in this module
// that imports @lifeos/db. The TaskRepository instance here is read-only
// usage (AgendaService composes Task deadlines in), its own instance rather
// than the Tasks module's — see ADR-0009's container sharing policy.
const calendarEventRepository = new CalendarEventRepository(prisma);
const taskRepository = new TaskRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);

export const calendarEventService = new CalendarEventService(
  calendarEventRepository,
  auditLogRepository,
);

export const agendaService = new AgendaService(calendarEventService, taskRepository);
