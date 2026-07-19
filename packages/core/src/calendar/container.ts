import { prisma, CalendarEventRepository, TaskRepository, AuditLogRepository } from "@lifeos/db";
import { CalendarEventService } from "./services/calendar-event-service";
import { AgendaService } from "./services/agenda-service";

// Composition root for the calendar module — the only file in this module
// that imports @lifeos/db. The TaskRepository instance here is read-only
// usage (AgendaService composes Task deadlines in), a separate instance
// from the Tasks module's own container, same as every other module wires
// its own repository instances independently.
const calendarEventRepository = new CalendarEventRepository(prisma);
const taskRepository = new TaskRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);

export const calendarEventService = new CalendarEventService(
  calendarEventRepository,
  auditLogRepository,
);

export const agendaService = new AgendaService(calendarEventService, taskRepository);
