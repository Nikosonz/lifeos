import 'package:flutter/material.dart';

import 'budgets_tab.dart';
import 'categories_tab.dart';
import 'dashboard_tab.dart';
import 'transactions_tab.dart';
import 'wallets_tab.dart';

/// Finance module home — a scrollable TabBar over the same five sub-pages
/// the web's sidebar exposes (Dashboard/Wallets/Categories/Transactions/
/// Budgets), since a phone has no room for five permanent nav destinations.
class FinanceHomeScreen extends StatelessWidget {
  const FinanceHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const DefaultTabController(
      length: 5,
      child: Column(
        children: [
          Material(
            color: Colors.transparent,
            child: TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: [
                Tab(text: 'داشبورد'),
                Tab(text: 'کیف پول‌ها'),
                Tab(text: 'دسته‌بندی‌ها'),
                Tab(text: 'تراکنش‌ها'),
                Tab(text: 'بودجه‌ها'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                DashboardTab(),
                WalletsTab(),
                CategoriesTab(),
                TransactionsTab(),
                BudgetsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
