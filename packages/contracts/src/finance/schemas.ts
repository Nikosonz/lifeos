import { z } from "zod";
import { SyncFields } from "../common/sync";
import { CursorQuery } from "../common/pagination";

// Rial has no fractional minor unit, so this is a plain non-negative
// integer string — not a decimal-point value. BigInt isn't JSON-safe, so
// every money field crosses the wire as this string form, parsed to BigInt
// in the route handler and formatted back with .toString() in the response.
export const MoneyAmountInput = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, "Must be a non-negative integer string (minor units)");
export type MoneyAmountInput = z.infer<typeof MoneyAmountInput>;

export const Currency = z.enum(["IRR"]);
export type Currency = z.infer<typeof Currency>;

// --- Wallets ---

export const WalletCreateInput = z.object({
  name: z.string().min(1).max(100),
  currency: Currency.default("IRR"),
});
export type WalletCreateInput = z.infer<typeof WalletCreateInput>;

export const WalletUpdateInput = z.object({
  name: z.string().min(1).max(100).optional(),
});
export type WalletUpdateInput = z.infer<typeof WalletUpdateInput>;

export const WalletResponse = SyncFields.extend({
  userId: z.uuid(),
  name: z.string(),
  currency: Currency,
  balance: MoneyAmountInput,
});
export type WalletResponse = z.infer<typeof WalletResponse>;

// --- Categories ---

export const CategoryType = z.enum(["INCOME", "EXPENSE"]);
export type CategoryType = z.infer<typeof CategoryType>;

export const CategoryCreateInput = z.object({
  name: z.string().min(1).max(100),
  type: CategoryType,
});
export type CategoryCreateInput = z.infer<typeof CategoryCreateInput>;

export const CategoryUpdateInput = z.object({
  name: z.string().min(1).max(100).optional(),
});
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateInput>;

export const CategoryResponse = SyncFields.extend({
  userId: z.uuid(),
  name: z.string(),
  type: CategoryType,
});
export type CategoryResponse = z.infer<typeof CategoryResponse>;

// --- Transactions ---

export const TransactionType = z.enum(["INCOME", "EXPENSE"]);
export type TransactionType = z.infer<typeof TransactionType>;

export const TransactionCreateInput = z.object({
  walletId: z.uuid(),
  categoryId: z.uuid(),
  type: TransactionType,
  amount: MoneyAmountInput,
  currency: Currency.default("IRR"),
  occurredAt: z.string().datetime(),
  note: z.string().max(500).optional(),
});
export type TransactionCreateInput = z.infer<typeof TransactionCreateInput>;

export const TransactionUpdateInput = z.object({
  walletId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  type: TransactionType.optional(),
  amount: MoneyAmountInput.optional(),
  currency: Currency.optional(),
  occurredAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});
export type TransactionUpdateInput = z.infer<typeof TransactionUpdateInput>;

export const TransactionResponse = SyncFields.extend({
  userId: z.uuid(),
  walletId: z.uuid(),
  categoryId: z.uuid(),
  type: TransactionType,
  amount: MoneyAmountInput,
  currency: Currency,
  occurredAt: z.string().datetime(),
  note: z.string().nullable(),
});
export type TransactionResponse = z.infer<typeof TransactionResponse>;

export const TransactionListQuery = CursorQuery.extend({
  walletId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
});
export type TransactionListQuery = z.infer<typeof TransactionListQuery>;

// --- Budgets ---

export const BudgetCreateInput = z.object({
  categoryId: z.uuid(),
  jalaliYear: z.number().int().min(1300).max(1500),
  jalaliMonth: z.number().int().min(1).max(12),
  limitAmount: MoneyAmountInput,
  currency: Currency.default("IRR"),
});
export type BudgetCreateInput = z.infer<typeof BudgetCreateInput>;

export const BudgetUpdateInput = z.object({
  limitAmount: MoneyAmountInput.optional(),
});
export type BudgetUpdateInput = z.infer<typeof BudgetUpdateInput>;

export const BudgetResponse = SyncFields.extend({
  userId: z.uuid(),
  categoryId: z.uuid(),
  jalaliYear: z.number().int(),
  jalaliMonth: z.number().int(),
  limitAmount: MoneyAmountInput,
  currency: Currency,
  spent: MoneyAmountInput,
  remaining: MoneyAmountInput,
});
export type BudgetResponse = z.infer<typeof BudgetResponse>;

export const BudgetListQuery = z.object({
  jalaliYear: z.coerce.number().int(),
  jalaliMonth: z.coerce.number().int().min(1).max(12),
});
export type BudgetListQuery = z.infer<typeof BudgetListQuery>;

// --- Dashboard ---

export const DashboardQuery = z.object({
  jalaliYear: z.coerce.number().int().optional(),
  jalaliMonth: z.coerce.number().int().min(1).max(12).optional(),
});
export type DashboardQuery = z.infer<typeof DashboardQuery>;

export const DashboardResponse = z.object({
  jalaliYear: z.number().int(),
  jalaliMonth: z.number().int(),
  totalBalance: MoneyAmountInput,
  wallets: z.array(z.object({ walletId: z.uuid(), name: z.string(), balance: MoneyAmountInput })),
  spendingByCategory: z.array(
    z.object({ categoryId: z.uuid(), categoryName: z.string(), spent: MoneyAmountInput }),
  ),
  budgets: z.array(
    z.object({
      categoryId: z.uuid(),
      categoryName: z.string(),
      limitAmount: MoneyAmountInput,
      spent: MoneyAmountInput,
      remaining: MoneyAmountInput,
    }),
  ),
});
export type DashboardResponse = z.infer<typeof DashboardResponse>;
