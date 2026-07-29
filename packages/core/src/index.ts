export * from "./errors/app-error";
export * from "./logging/logger";
export * from "./http/response";
// Exported so apps/web can read validated config (e.g. the trusted-proxy
// IP header) without a second, unvalidated `process.env` read of its own —
// EnvSchema stays the single place every environment variable is declared.
export * from "./config/env";
export * from "./rate-limit/container";
export * from "./rate-limit/policies";
export type { RateLimitRule } from "./rate-limit/services/rate-limit-service";
export * from "./auth/container";
export type { DeviceInfo, AuthTokens } from "./auth/services/session-service";
export * from "./finance/container";
export type { WalletWithBalance } from "./finance/services/wallet-service";
export type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "./finance/services/transaction-service";
export type { BudgetWithSpending } from "./finance/services/budget-service";
export type { DashboardResult } from "./finance/services/dashboard-service";
// Re-exported so route handlers can type their response-mapping helpers
// without importing @lifeos/db directly (never allowed under apps/web —
// see the ESLint boundaries config).
export type { FinanceCategory, FinanceTransaction, FinanceBudget } from "@lifeos/db";
export * from "./tasks/container";
export type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksInput,
} from "./tasks/services/task-service";
export type { UpdateSubtaskInput } from "./tasks/services/subtask-service";
export type {
  TaskProject,
  TaskWithLabels,
  Subtask,
  TaskLabel,
  TaskStatus,
  TaskPriority,
} from "@lifeos/db";
export * from "./calendar/container";
export type {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  Occurrence,
} from "./calendar/services/calendar-event-service";
export type {
  CalendarItem,
  CalendarEventItem,
  CalendarTaskItem,
  CalendarHolidayItem,
} from "./calendar/services/agenda-service";
export type { RecurrenceFreq } from "./calendar/recurrence";
export { getHolidaysForJalaliYear } from "./calendar/holidays";
export type { Holiday } from "./calendar/holidays";
export type { CalendarEvent, CalendarPreference, CalendarRecurrenceFreq, User } from "@lifeos/db";
// Promoted from finance/jalali.ts (ADR-0006 predicted this) now that
// Calendar is a second consumer; route handlers resolving a
// jalaliYear/jalaliMonth range query need this directly.
export * from "./shared/jalali";
export * from "./notifications/container";
export type { CreateNotificationInput } from "./notifications/services/notification-service";
export type { Notification } from "@lifeos/db";
export * from "./reports/container";
export type { DashboardReportResult } from "./reports/services/reports-service";
export * from "./telemetry/container";
export type { IngestCrashInput, IngestEventInput } from "./telemetry/services/telemetry-service";
export type { TelemetryCrashKind, TelemetryEventName } from "@lifeos/db";
export * from "./habits/container";
export type { HabitWithStatus } from "./habits/services/habit-service";
export type { JalaliCalendarDate } from "./habits/streak";
export type { Habit, HabitCheckIn, HabitFrequency } from "@lifeos/db";
