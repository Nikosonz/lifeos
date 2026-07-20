import {
  prisma,
  FinanceWalletRepository,
  FinanceCategoryRepository,
  FinanceTransactionRepository,
  FinanceBudgetRepository,
  IdempotencyKeyRepository,
  AuditLogRepository,
  NotificationRepository,
} from "@lifeos/db";
import { WalletService } from "./services/wallet-service";
import { CategoryService } from "./services/category-service";
import { TransactionService } from "./services/transaction-service";
import { BudgetService } from "./services/budget-service";
import { DashboardService } from "./services/dashboard-service";
import { NotificationService } from "../notifications/services/notification-service";

// Composition root for the finance module — the only file in this module
// that imports @lifeos/db. apps/web imports the exported singletons below
// and never touches @lifeos/db directly (enforced by ESLint boundaries).
const walletRepository = new FinanceWalletRepository(prisma);
const categoryRepository = new FinanceCategoryRepository(prisma);
const transactionRepository = new FinanceTransactionRepository(prisma);
const budgetRepository = new FinanceBudgetRepository(prisma);
const idempotencyKeyRepository = new IdempotencyKeyRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);

// Finance's own independent NotificationRepository/Service instance — same
// "every module wires its own instance independently" reasoning Calendar's
// container already established for its TaskRepository. Both this instance
// and the Notifications module's own singleton are stateless wrappers over
// the same underlying table via the same prisma singleton, so this is
// behaviorally identical to sharing one instance, without Finance's
// container ever needing to import Notifications' container. See ADR-0009.
const financeNotificationRepository = new NotificationRepository(prisma);
const financeNotificationService = new NotificationService(
  financeNotificationRepository,
  auditLogRepository,
);

export const walletService = new WalletService(
  walletRepository,
  transactionRepository,
  auditLogRepository,
);

export const categoryService = new CategoryService(categoryRepository, auditLogRepository);

export const budgetService = new BudgetService(
  budgetRepository,
  categoryRepository,
  transactionRepository,
  auditLogRepository,
);

export const transactionService = new TransactionService(
  transactionRepository,
  walletRepository,
  categoryRepository,
  idempotencyKeyRepository,
  auditLogRepository,
  budgetService,
  financeNotificationService,
);

export const dashboardService = new DashboardService(
  walletService,
  transactionRepository,
  categoryRepository,
  budgetService,
);
