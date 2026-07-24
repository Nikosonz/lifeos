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

// Finance's own independent NotificationRepository/Service instance — see
// ADR-0009's container sharing policy (a cheap, stateless repository/service
// gets its own instance per consuming module, never a cross-container
// import of a sibling's singleton).
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
