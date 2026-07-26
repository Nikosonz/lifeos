import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart'; // StateProvider — simple local UI state, not app data

import '../../finance/finance_providers.dart';
import '../../shared/format_jalali.dart';
import '../../shared/format_money.dart';

final _dashboardMonthProvider = StateProvider.autoDispose<DashboardArgs>((ref) => (null, null));

class DashboardTab extends ConsumerWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = ref.watch(_dashboardMonthProvider);
    final dashboard = ref.watch(dashboardProvider(args));

    return Scaffold(
      body: dashboard.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطا: $e')),
        data: (d) {
          final negative = d.totalBalance.startsWith('-');
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(dashboardProvider(args)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_right),
                      onPressed: () => ref.read(_dashboardMonthProvider.notifier).state = (
                        d.jalaliMonth == 1 ? d.jalaliYear - 1 : d.jalaliYear,
                        d.jalaliMonth == 1 ? 12 : d.jalaliMonth - 1,
                      ),
                    ),
                    Text(jalaliMonthLabel(d.jalaliYear, d.jalaliMonth, fa: true),
                        style: Theme.of(context).textTheme.titleMedium),
                    IconButton(
                      icon: const Icon(Icons.chevron_left),
                      onPressed: () => ref.read(_dashboardMonthProvider.notifier).state = (
                        d.jalaliMonth == 12 ? d.jalaliYear + 1 : d.jalaliYear,
                        d.jalaliMonth == 12 ? 1 : d.jalaliMonth + 1,
                      ),
                    ),
                  ],
                ),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        const Text('موجودی کل', style: TextStyle(color: Colors.grey)),
                        const SizedBox(height: 8),
                        Text(
                          '${formatTomanFromRial(d.totalBalance, fa: true)} تومان',
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            color: negative ? Theme.of(context).colorScheme.error : null,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (d.wallets.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('کیف پول‌ها', style: Theme.of(context).textTheme.titleMedium),
                  for (final w in d.wallets)
                    ListTile(
                      dense: true,
                      title: Text(w.name),
                      trailing: Text('${formatTomanFromRial(w.balance, fa: true)} تومان'),
                    ),
                ],
                if (d.spendingByCategory.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('هزینه بر اساس دسته‌بندی', style: Theme.of(context).textTheme.titleMedium),
                  for (final s in d.spendingByCategory)
                    ListTile(
                      dense: true,
                      title: Text(s.categoryName),
                      trailing: Text('${formatTomanFromRial(s.spent, fa: true)} تومان'),
                    ),
                ],
                if (d.budgets.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('بودجه‌ها', style: Theme.of(context).textTheme.titleMedium),
                  for (final b in d.budgets)
                    ListTile(
                      dense: true,
                      title: Text(b.categoryName),
                      subtitle: Text('${formatTomanFromRial(b.spent, fa: true)} / ${formatTomanFromRial(b.limitAmount, fa: true)} تومان'),
                      trailing: Text(
                        formatTomanFromRial(b.remaining, fa: true),
                        style: TextStyle(
                          color: b.remaining.startsWith('-') ? Theme.of(context).colorScheme.error : Colors.green,
                        ),
                      ),
                    ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
