import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart'; // StateProvider — simple local UI state, not app data

import '../../finance/finance_providers.dart';
import '../../theme/module_colors.dart';
import '../../theme/tokens/spacing.dart';
import '../widgets/widgets.dart';

final _dashboardMonthProvider = StateProvider.autoDispose<DashboardArgs>(
  (ref) => (null, null),
);

class DashboardTab extends ConsumerWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = ref.watch(_dashboardMonthProvider);
    final dashboard = ref.watch(dashboardProvider(args));

    return AppScaffold(
      onRefresh: () async => ref.invalidate(dashboardProvider(args)),
      body: AsyncValueView(
        value: dashboard,
        onRetry: () => ref.invalidate(dashboardProvider(args)),
        data: (context, d) => ListView(
          children: [
            MonthStepper(
              year: d.jalaliYear,
              month: d.jalaliMonth,
              onChanged: (ym) =>
                  ref.read(_dashboardMonthProvider.notifier).state = ym,
            ),
            StatCard(
              label: 'موجودی کل',
              value: MoneyText(d.totalBalance, sign: MoneySign.signed),
            ),
            if (d.wallets.isNotEmpty) ...[
              const SectionHeader('کیف پول‌ها'),
              for (final w in d.wallets)
                AppListRow(
                  leadingIcon: Icons.account_balance_wallet_outlined,
                  module: ModuleKey.finance,
                  title: Text(w.name),
                  trailing: MoneyText(
                    w.balance,
                    sign: MoneySign.signed,
                    suffix: '',
                  ),
                ),
            ],
            if (d.spendingByCategory.isNotEmpty) ...[
              const SectionHeader('هزینه بر اساس دسته‌بندی'),
              for (final s in d.spendingByCategory)
                AppListRow(
                  module: ModuleKey.finance,
                  title: Text(s.categoryName),
                  trailing: MoneyText(s.spent, suffix: ''),
                ),
            ],
            if (d.budgets.isNotEmpty) ...[
              const SectionHeader('بودجه‌ها'),
              for (final b in d.budgets)
                AppListRow(
                  module: ModuleKey.finance,
                  title: Text(b.categoryName),
                  subtitle: Row(
                    children: [
                      MoneyText(
                        b.spent,
                        suffix: '',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const Text(' / '),
                      MoneyText(
                        b.limitAmount,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                  trailing: MoneyText(
                    b.remaining,
                    sign: MoneySign.signed,
                    suffix: '',
                  ),
                ),
            ],
            const SizedBox(height: Spacing.xl),
          ],
        ),
      ),
    );
  }
}
