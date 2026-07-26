import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../generated/generated.dart';
import '../providers.dart';
import 'finance_repository.dart';

final financeRepositoryProvider = Provider<FinanceRepository>(
  (ref) => FinanceRepository(ref.read(apiClientProvider)),
);

/// (jalaliYear, jalaliMonth) — null,null means "server's current month".
typedef DashboardArgs = (int?, int?);

final dashboardProvider = FutureProvider.autoDispose.family<DashboardResponse, DashboardArgs>(
  (ref, args) => ref.read(financeRepositoryProvider).dashboard(jalaliYear: args.$1, jalaliMonth: args.$2),
);

final walletsProvider = FutureProvider.autoDispose<List<WalletResponse>>(
  (ref) => ref.read(financeRepositoryProvider).listWallets(),
);

final categoriesProvider = FutureProvider.autoDispose<List<CategoryResponse>>(
  (ref) => ref.read(financeRepositoryProvider).listCategories(),
);

final budgetsProvider = FutureProvider.autoDispose.family<List<BudgetResponse>, DashboardArgs>(
  (ref, args) {
    final now = DateTime.now();
    return ref.read(financeRepositoryProvider).listBudgets(
      jalaliYear: args.$1 ?? now.year,
      jalaliMonth: args.$2 ?? now.month,
    );
  },
);

typedef TransactionPage = ({List<TransactionResponse> items, String? nextCursor});

/// Cursor-paginated transaction list — same shape as the web's
/// useInfiniteQuery over GET /finance/transactions. [loadMore] appends the
/// next page in place; the list re-fetches from scratch on invalidation.
class TransactionsController extends AsyncNotifier<TransactionPage> {
  @override
  Future<TransactionPage> build() => ref.read(financeRepositoryProvider).listTransactions();

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.nextCursor == null) return;
    final more = await ref.read(financeRepositoryProvider).listTransactions(cursor: current.nextCursor);
    state = AsyncData((items: [...current.items, ...more.items], nextCursor: more.nextCursor));
  }
}

final transactionsProvider = AsyncNotifierProvider.autoDispose<TransactionsController, TransactionPage>(
  TransactionsController.new,
);

/// Broad invalidation on every mutation — same "simpler and correct at this
/// data scale" call CLAUDE.md documents for the web's ["finance"] query-key
/// invalidation.
void invalidateFinance(WidgetRef ref) {
  ref.invalidate(dashboardProvider);
  ref.invalidate(walletsProvider);
  ref.invalidate(categoriesProvider);
  ref.invalidate(budgetsProvider);
  ref.invalidate(transactionsProvider);
}
