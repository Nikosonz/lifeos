import { z } from "zod";
import {
  WalletResponse,
  WalletCreateInput,
  WalletUpdateInput,
  CategoryResponse,
  CategoryCreateInput,
  CategoryUpdateInput,
  TransactionResponse,
  TransactionCreateInput,
  TransactionUpdateInput,
  BudgetResponse,
  BudgetCreateInput,
  BudgetUpdateInput,
  DashboardResponse,
} from "@lifeos/contracts";
import { apiFetch } from "./api-client";

// Response wrapper shapes confirmed by reading the actual route handlers
// directly (apps/web/src/app/api/v1/finance/**/route.ts) — wallets/
// categories/budgets each wrap their array in a named key, only
// transactions uses the generic cursor-pagination envelope.
const WalletsListResponse = z.object({ wallets: z.array(WalletResponse) });
const CategoriesListResponse = z.object({ categories: z.array(CategoryResponse) });
const BudgetsListResponse = z.object({ budgets: z.array(BudgetResponse) });
const TransactionsListResponse = z.object({
  items: z.array(TransactionResponse),
  nextCursor: z.string().nullable(),
});

export const financeApi = {
  listWallets: () => apiFetch("/api/v1/finance/wallets", { schema: WalletsListResponse }),
  createWallet: (input: WalletCreateInput) =>
    apiFetch("/api/v1/finance/wallets", { method: "POST", body: input, schema: WalletResponse }),
  updateWallet: (id: string, input: WalletUpdateInput) =>
    apiFetch(`/api/v1/finance/wallets/${id}`, {
      method: "PATCH",
      body: input,
      schema: WalletResponse,
    }),
  deleteWallet: (id: string) => apiFetch(`/api/v1/finance/wallets/${id}`, { method: "DELETE" }),

  listCategories: () => apiFetch("/api/v1/finance/categories", { schema: CategoriesListResponse }),
  createCategory: (input: CategoryCreateInput) =>
    apiFetch("/api/v1/finance/categories", {
      method: "POST",
      body: input,
      schema: CategoryResponse,
    }),
  updateCategory: (id: string, input: CategoryUpdateInput) =>
    apiFetch(`/api/v1/finance/categories/${id}`, {
      method: "PATCH",
      body: input,
      schema: CategoryResponse,
    }),
  deleteCategory: (id: string) =>
    apiFetch(`/api/v1/finance/categories/${id}`, { method: "DELETE" }),

  listTransactions: (params: {
    cursor?: string;
    limit?: number;
    walletId?: string;
    categoryId?: string;
  }) =>
    apiFetch("/api/v1/finance/transactions", { query: params, schema: TransactionsListResponse }),
  createTransaction: (input: TransactionCreateInput, idempotencyKey: string) =>
    apiFetch("/api/v1/finance/transactions", {
      method: "POST",
      body: input,
      idempotencyKey,
      schema: TransactionResponse,
    }),
  updateTransaction: (id: string, input: TransactionUpdateInput, idempotencyKey: string) =>
    apiFetch(`/api/v1/finance/transactions/${id}`, {
      method: "PATCH",
      body: input,
      idempotencyKey,
      schema: TransactionResponse,
    }),
  deleteTransaction: (id: string) =>
    apiFetch(`/api/v1/finance/transactions/${id}`, { method: "DELETE" }),

  listBudgets: (jalaliYear: number, jalaliMonth: number) =>
    apiFetch("/api/v1/finance/budgets", {
      query: { jalaliYear, jalaliMonth },
      schema: BudgetsListResponse,
    }),
  createBudget: (input: BudgetCreateInput) =>
    apiFetch("/api/v1/finance/budgets", { method: "POST", body: input, schema: BudgetResponse }),
  updateBudget: (id: string, input: BudgetUpdateInput) =>
    apiFetch(`/api/v1/finance/budgets/${id}`, {
      method: "PATCH",
      body: input,
      schema: BudgetResponse,
    }),
  deleteBudget: (id: string) => apiFetch(`/api/v1/finance/budgets/${id}`, { method: "DELETE" }),

  getDashboard: (override?: { jalaliYear: number; jalaliMonth: number }) =>
    apiFetch("/api/v1/finance/dashboard", {
      ...(override ? { query: override } : {}),
      schema: DashboardResponse,
    }),
};
