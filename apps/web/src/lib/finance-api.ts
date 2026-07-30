import {
  WalletResponse,
  WalletCreateInput,
  WalletUpdateInput,
  WalletListResponse,
  CategoryResponse,
  CategoryCreateInput,
  CategoryUpdateInput,
  CategoryListResponse,
  TransactionResponse,
  TransactionCreateInput,
  TransactionUpdateInput,
  TransactionListResponse,
  BudgetResponse,
  BudgetCreateInput,
  BudgetUpdateInput,
  BudgetListResponse,
  DashboardResponse,
  OkResponse,
} from "@lifeos/contracts";
import { apiFetch } from "./api-client";
import type { Versioned } from "./api-client";

export const financeApi = {
  listWallets: () => apiFetch("/api/v1/finance/wallets", { schema: WalletListResponse }),
  createWallet: (input: WalletCreateInput) =>
    apiFetch("/api/v1/finance/wallets", { method: "POST", body: input, schema: WalletResponse }),
  updateWallet: (id: string, input: Versioned<WalletUpdateInput>) =>
    apiFetch(`/api/v1/finance/wallets/${id}`, {
      method: "PATCH",
      body: input,
      schema: WalletResponse,
    }),
  deleteWallet: (id: string, expectedVersion: number) =>
    apiFetch(`/api/v1/finance/wallets/${id}`, {
      method: "DELETE",
      body: { expectedVersion },
      schema: OkResponse,
    }),

  listCategories: () => apiFetch("/api/v1/finance/categories", { schema: CategoryListResponse }),
  createCategory: (input: CategoryCreateInput) =>
    apiFetch("/api/v1/finance/categories", {
      method: "POST",
      body: input,
      schema: CategoryResponse,
    }),
  updateCategory: (id: string, input: Versioned<CategoryUpdateInput>) =>
    apiFetch(`/api/v1/finance/categories/${id}`, {
      method: "PATCH",
      body: input,
      schema: CategoryResponse,
    }),
  deleteCategory: (id: string, expectedVersion: number) =>
    apiFetch(`/api/v1/finance/categories/${id}`, {
      method: "DELETE",
      body: { expectedVersion },
      schema: OkResponse,
    }),

  listTransactions: (params: {
    cursor?: string;
    limit?: number;
    walletId?: string;
    categoryId?: string;
  }) =>
    apiFetch("/api/v1/finance/transactions", { query: params, schema: TransactionListResponse }),
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
    apiFetch(`/api/v1/finance/transactions/${id}`, { method: "DELETE", schema: OkResponse }),

  listBudgets: (jalaliYear: number, jalaliMonth: number) =>
    apiFetch("/api/v1/finance/budgets", {
      query: { jalaliYear, jalaliMonth },
      schema: BudgetListResponse,
    }),
  createBudget: (input: BudgetCreateInput) =>
    apiFetch("/api/v1/finance/budgets", { method: "POST", body: input, schema: BudgetResponse }),
  updateBudget: (id: string, input: Versioned<BudgetUpdateInput>) =>
    apiFetch(`/api/v1/finance/budgets/${id}`, {
      method: "PATCH",
      body: input,
      schema: BudgetResponse,
    }),
  deleteBudget: (id: string, expectedVersion: number) =>
    apiFetch(`/api/v1/finance/budgets/${id}`, {
      method: "DELETE",
      body: { expectedVersion },
      schema: OkResponse,
    }),

  getDashboard: (override?: { jalaliYear: number; jalaliMonth: number }) =>
    apiFetch("/api/v1/finance/dashboard", {
      ...(override ? { query: override } : {}),
      schema: DashboardResponse,
    }),
};
