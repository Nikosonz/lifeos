import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../generated/generated.dart';

/// Thin client over /api/v1/finance/* — no business logic (Rule 1); every
/// balance/spent/remaining figure below is rendered exactly as the server
/// computed it, never recomputed here.
class FinanceRepository {
  final ApiClient _api;
  FinanceRepository(this._api);

  static const _uuid = Uuid();

  Future<DashboardResponse> dashboard({int? jalaliYear, int? jalaliMonth}) async {
    final data = await _api.get('/api/v1/finance/dashboard', query: {
      'jalaliYear': ?jalaliYear,
      'jalaliMonth': ?jalaliMonth,
    });
    return DashboardResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  // --- Wallets ---

  Future<List<WalletResponse>> listWallets() async {
    final data = await _api.get('/api/v1/finance/wallets');
    return (data['wallets'] as List<dynamic>).cast<Map<String, dynamic>>().map(WalletResponse.fromJson).toList();
  }

  Future<WalletResponse> createWallet(WalletCreateInput input) async {
    final data = await _api.post('/api/v1/finance/wallets', body: input.toJson());
    return WalletResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteWallet(String id) async {
    await _api.delete('/api/v1/finance/wallets/$id');
  }

  // --- Categories ---

  Future<List<CategoryResponse>> listCategories() async {
    final data = await _api.get('/api/v1/finance/categories');
    return (data['categories'] as List<dynamic>).cast<Map<String, dynamic>>().map(CategoryResponse.fromJson).toList();
  }

  Future<CategoryResponse> createCategory(CategoryCreateInput input) async {
    final data = await _api.post('/api/v1/finance/categories', body: input.toJson());
    return CategoryResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteCategory(String id) async {
    await _api.delete('/api/v1/finance/categories/$id');
  }

  // --- Transactions ---

  Future<({List<TransactionResponse> items, String? nextCursor})> listTransactions({
    String? cursor,
    int limit = 20,
    String? walletId,
    String? categoryId,
  }) async {
    final data = await _api.get('/api/v1/finance/transactions', query: {
      'cursor': ?cursor,
      'limit': limit,
      'walletId': ?walletId,
      'categoryId': ?categoryId,
    });
    final items = (data['items'] as List<dynamic>).cast<Map<String, dynamic>>().map(TransactionResponse.fromJson).toList();
    return (items: items, nextCursor: data['nextCursor'] as String?);
  }

  /// Idempotency-Key is a fresh uuid per user-initiated submit — a retried
  /// tap (flaky network, double-tap) must never double-post a transaction.
  Future<TransactionResponse> createTransaction(TransactionCreateInput input) async {
    final data = await _api.post(
      '/api/v1/finance/transactions',
      body: input.toJson(),
      idempotencyKey: _uuid.v4(),
    );
    return TransactionResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteTransaction(String id) async {
    await _api.delete('/api/v1/finance/transactions/$id');
  }

  // --- Budgets ---

  Future<List<BudgetResponse>> listBudgets({required int jalaliYear, required int jalaliMonth}) async {
    final data = await _api.get('/api/v1/finance/budgets', query: {
      'jalaliYear': jalaliYear,
      'jalaliMonth': jalaliMonth,
    });
    return (data['budgets'] as List<dynamic>).cast<Map<String, dynamic>>().map(BudgetResponse.fromJson).toList();
  }

  Future<BudgetResponse> createBudget(BudgetCreateInput input) async {
    final data = await _api.post('/api/v1/finance/budgets', body: input.toJson());
    return BudgetResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteBudget(String id) async {
    await _api.delete('/api/v1/finance/budgets/$id');
  }
}
