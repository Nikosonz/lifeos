import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../../reports/reports_providers.dart';
import '../../shared/format_jalali.dart';
import '../../shared/format_money.dart';

final _monthProvider = StateProvider.autoDispose<MonthArgs>((ref) => (null, null));

/// Reports is a pure read-side composition — no data of its own. Shows only
/// Finance's totalBalance + budgets (the "am I overspending" view) beside
/// Tasks' completed/created counts, deliberately not duplicating the
/// Finance dashboard's wallet-by-wallet/spending-by-category cards (see
/// CLAUDE.md's documented rationale: the value-add here is the
/// composition, not a second copy of the same cards).
class ReportsHomeScreen extends ConsumerWidget {
  const ReportsHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = ref.watch(_monthProvider);
    final report = ref.watch(reportsDashboardProvider(args));

    return Scaffold(
      body: report.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطا: $e')),
        data: (r) {
          final negative = r.finance.totalBalance.startsWith('-');
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(reportsDashboardProvider(args)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_right),
                      onPressed: () => ref.read(_monthProvider.notifier).state = (
                        r.jalaliMonth == 1 ? r.jalaliYear - 1 : r.jalaliYear,
                        r.jalaliMonth == 1 ? 12 : r.jalaliMonth - 1,
                      ),
                    ),
                    Text(jalaliMonthLabel(r.jalaliYear, r.jalaliMonth, fa: true), style: Theme.of(context).textTheme.titleMedium),
                    IconButton(
                      icon: const Icon(Icons.chevron_left),
                      onPressed: () => ref.read(_monthProvider.notifier).state = (
                        r.jalaliMonth == 12 ? r.jalaliYear + 1 : r.jalaliYear,
                        r.jalaliMonth == 12 ? 1 : r.jalaliMonth + 1,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Expanded(
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            children: [
                              const Text('موجودی کل', style: TextStyle(color: Colors.grey, fontSize: 12)),
                              const SizedBox(height: 6),
                              Text(
                                '${formatTomanFromRial(r.finance.totalBalance, fa: true)} ت',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: negative ? Theme.of(context).colorScheme.error : null,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            children: [
                              const Text('وظایف انجام‌شده', style: TextStyle(color: Colors.grey, fontSize: 12)),
                              const SizedBox(height: 6),
                              Text(
                                '${toPersianDigits('${r.tasks.completed}')} / ${toPersianDigits('${r.tasks.created}')}',
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                if (r.finance.budgets.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('بودجه‌ها', style: Theme.of(context).textTheme.titleMedium),
                  for (final b in r.finance.budgets)
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
