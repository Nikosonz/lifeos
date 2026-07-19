export * from "./errors/app-error";
export * from "./logging/logger";
export * from "./http/response";
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
