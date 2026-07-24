import { createHash } from "node:crypto";
import type {
  IFinanceTransactionRepository,
  IFinanceWalletRepository,
  IFinanceCategoryRepository,
  IIdempotencyKeyRepository,
  IAuditLogRepository,
  FinanceTransaction,
  FinanceTransactionType,
} from "@lifeos/db";
import { IdempotencyKeyRaceError } from "@lifeos/db";
import { ConflictError, NotFoundError } from "../../errors/app-error";
import { logger } from "../../logging/logger";
import { getJalaliYearMonthForInstant } from "../../shared/jalali";
import type { BudgetService } from "./budget-service";
import type { NotificationService } from "../../notifications/services/notification-service";

// NotificationService.create's `type` is a plain string (see ADR-0011) — this
// local literal type is what actually catches a typo at this call site,
// since a bare `string` parameter alone would accept anything.
type FinanceNotificationEventType = "FINANCE_BUDGET_EXCEEDED";

export interface CreateTransactionInput {
  walletId: string;
  categoryId: string;
  type: FinanceTransactionType;
  amount: bigint;
  currency: string;
  occurredAt: Date;
  note?: string | null;
}

export interface UpdateTransactionInput {
  walletId?: string;
  categoryId?: string;
  type?: FinanceTransactionType;
  amount?: bigint;
  currency?: string;
  occurredAt?: Date;
  note?: string | null;
}

interface ListOptions {
  cursor?: Date;
  limit: number;
  walletId?: string;
  categoryId?: string;
}

// Never JSON.stringify a BigInt (throws) — build the canonical string
// manually instead. Field order is fixed by this function, not by however
// the caller happened to construct the input object, so the hash is stable
// regardless of property insertion order.
function createHashInput(input: CreateTransactionInput): string {
  return [
    input.walletId,
    input.categoryId,
    input.type,
    input.amount.toString(),
    input.currency,
    input.occurredAt.toISOString(),
    input.note ?? "",
  ].join("|");
}

// Same caveat as createHashInput, plus one accepted edge case: an
// explicitly-set `note: ""` hashes the same as an omitted `note` (both
// serialize to the empty-string sentinel). This is a convenience dedup
// check, not a security boundary, so that collision is an acceptable
// simplification rather than something worth a presence-flag scheme for.
function updateHashInput(id: string, input: UpdateTransactionInput): string {
  return [
    id,
    input.walletId ?? "",
    input.categoryId ?? "",
    input.type ?? "",
    input.amount !== undefined ? input.amount.toString() : "",
    input.currency ?? "",
    input.occurredAt ? input.occurredAt.toISOString() : "",
    input.note ?? "",
  ].join("|");
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Exposed for tests that need to construct a realistic concurrent-race
// scenario (the exact hash a given create input would produce) without
// duplicating the hashing logic — see transaction-service.test.ts.
export function hashCreateTransactionInput(input: CreateTransactionInput): string {
  return sha256Hex(createHashInput(input));
}

export class TransactionService {
  constructor(
    private readonly transactionRepository: IFinanceTransactionRepository,
    private readonly walletRepository: IFinanceWalletRepository,
    private readonly categoryRepository: IFinanceCategoryRepository,
    private readonly idempotencyKeyRepository: IIdempotencyKeyRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly budgetService: BudgetService,
    private readonly notificationService: NotificationService,
  ) {}

  async createTransaction(
    userId: string,
    input: CreateTransactionInput,
    idempotencyKey?: string,
  ): Promise<FinanceTransaction> {
    await this.assertOwnership(userId, input.walletId, input.categoryId);

    if (!idempotencyKey) {
      const created = await this.transactionRepository.create({ userId, ...input });
      await this.audit(userId, "created", created.id);
      await this.maybeNotifyBudgetExceeded(userId, created);
      return created;
    }

    const requestHash = sha256Hex(createHashInput(input));
    const existing = await this.idempotencyKeyRepository.findByUserAndKey(userId, idempotencyKey);
    if (existing) return this.replayOrConflict(existing, requestHash);

    try {
      const created = await this.transactionRepository.createWithIdempotency(
        { userId, ...input },
        { key: idempotencyKey, requestHash },
      );
      await this.audit(userId, "created", created.id);
      await this.maybeNotifyBudgetExceeded(userId, created);
      return created;
    } catch (err) {
      if (err instanceof IdempotencyKeyRaceError) {
        const winner = await this.idempotencyKeyRepository.findByUserAndKey(userId, idempotencyKey);
        if (winner) return this.replayOrConflict(winner, requestHash);
      }
      throw err;
    }
  }

  async updateTransaction(
    id: string,
    userId: string,
    input: UpdateTransactionInput,
    idempotencyKey?: string,
  ): Promise<FinanceTransaction> {
    const existingTx = await this.getOwned(id, userId);
    if (input.walletId || input.categoryId) {
      await this.assertOwnership(
        userId,
        input.walletId ?? existingTx.walletId,
        input.categoryId ?? existingTx.categoryId,
      );
    }

    if (!idempotencyKey) {
      const updated = await this.transactionRepository.update(id, input);
      await this.audit(userId, "updated", id);
      return updated;
    }

    const requestHash = sha256Hex(updateHashInput(id, input));
    const existing = await this.idempotencyKeyRepository.findByUserAndKey(userId, idempotencyKey);
    if (existing) return this.replayOrConflict(existing, requestHash);

    try {
      const updated = await this.transactionRepository.updateWithIdempotency(id, input, userId, {
        key: idempotencyKey,
        requestHash,
      });
      await this.audit(userId, "updated", id);
      return updated;
    } catch (err) {
      if (err instanceof IdempotencyKeyRaceError) {
        const winner = await this.idempotencyKeyRepository.findByUserAndKey(userId, idempotencyKey);
        if (winner) return this.replayOrConflict(winner, requestHash);
      }
      throw err;
    }
  }

  async getTransaction(id: string, userId: string): Promise<FinanceTransaction> {
    return this.getOwned(id, userId);
  }

  listTransactions(userId: string, opts: ListOptions): Promise<FinanceTransaction[]> {
    return this.transactionRepository.findByUserId(userId, opts);
  }

  async deleteTransaction(id: string, userId: string): Promise<void> {
    const tx = await this.getOwned(id, userId);
    await this.transactionRepository.softDelete(id);
    await this.audit(userId, "deleted", tx.id);
  }

  // A stored idempotency-key row's requestHash matching means "replay":
  // return the resource's current state, with no new write and no new
  // audit-log entry for this call. A mismatch means the same key was reused
  // for a genuinely different request body, which is a client bug, not a
  // race — surfaced as a 409 rather than silently doing the wrong thing.
  private async replayOrConflict(
    existing: { requestHash: string; resourceId: string },
    requestHash: string,
  ): Promise<FinanceTransaction> {
    if (existing.requestHash !== requestHash) {
      throw new ConflictError("Idempotency-Key already used with a different request body");
    }
    const transaction = await this.transactionRepository.findById(existing.resourceId);
    if (!transaction) throw new NotFoundError("Transaction");
    return transaction;
  }

  private async getOwned(id: string, userId: string): Promise<FinanceTransaction> {
    const tx = await this.transactionRepository.findById(id);
    if (!tx || tx.userId !== userId || tx.deletedAt) throw new NotFoundError("Transaction");
    return tx;
  }

  private async assertOwnership(
    userId: string,
    walletId: string,
    categoryId: string,
  ): Promise<void> {
    const [wallet, category] = await Promise.all([
      this.walletRepository.findById(walletId),
      this.categoryRepository.findById(categoryId),
    ]);
    if (!wallet || wallet.userId !== userId || wallet.deletedAt) throw new NotFoundError("Wallet");
    if (!category || category.userId !== userId || category.deletedAt) {
      throw new NotFoundError("Category");
    }
  }

  // Fires only on the transaction that causes spend to cross the budget
  // limit (spentBefore <= limit < spentAfter) — not on every subsequent
  // over-budget transaction, and only on genuine inserts (never the replay
  // path, since replay didn't change any spend total). See ADR-0009: this
  // is a best-effort side effect and must never fail or roll back the
  // financial write that already committed.
  private async maybeNotifyBudgetExceeded(userId: string, tx: FinanceTransaction): Promise<void> {
    if (tx.type !== "EXPENSE") return;
    try {
      const { year, month } = getJalaliYearMonthForInstant(tx.occurredAt);
      const budgets = await this.budgetService.listWithSpending(userId, year, month);
      const budget = budgets.find((b) => b.categoryId === tx.categoryId);
      if (!budget) return;
      const spentAfter = budget.spent;
      const spentBefore = spentAfter - tx.amount;
      if (!(spentBefore <= budget.limitAmount && spentAfter > budget.limitAmount)) return;

      const category = await this.categoryRepository.findById(tx.categoryId);
      const type: FinanceNotificationEventType = "FINANCE_BUDGET_EXCEEDED";
      await this.notificationService.create(userId, {
        type,
        title: "بودجه دسته‌بندی تمام شد",
        body: `هزینه‌های «${category?.name ?? "دسته‌بندی"}» در ${year}/${month} از سقف بودجه عبور کرد.`,
        data: {
          categoryId: tx.categoryId,
          jalaliYear: year,
          jalaliMonth: month,
          limitAmount: budget.limitAmount.toString(),
          spent: spentAfter.toString(),
        },
      });
    } catch (err) {
      logger.error(
        { event: "finance.transaction.notify_failed", userId, transactionId: tx.id, err },
        "budget-exceeded notification failed",
      );
    }
  }

  private async audit(
    userId: string,
    action: "created" | "updated" | "deleted",
    transactionId: string,
  ): Promise<void> {
    await this.auditLogRepository.record({
      userId,
      action: `finance.transaction.${action}`,
      metadata: { transactionId },
    });
    logger.info(
      { event: `finance.transaction.${action}`, userId, transactionId },
      `transaction ${action}`,
    );
  }
}
