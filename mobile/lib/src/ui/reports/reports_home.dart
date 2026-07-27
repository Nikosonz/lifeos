import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../../reports/reports_providers.dart';
import '../../shared/format_money.dart';
import '../../theme/module_colors.dart';
import '../../theme/tokens/spacing.dart';
import '../widgets/widgets.dart';

final _monthProvider = StateProvider.autoDispose<MonthArgs>(
  (ref) => (null, null),
);

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

    return AppScaffold(
      onRefresh: () async => ref.invalidate(reportsDashboardProvider(args)),
      body: AsyncValueView(
        value: report,
        onRetry: () => ref.invalidate(reportsDashboardProvider(args)),
        data: (context, r) => ListView(
          children: [
            MonthStepper(
              year: r.jalaliYear,
              month: r.jalaliMonth,
              onChanged: (ym) => ref.read(_monthProvider.notifier).state = ym,
            ),
            Row(
              children: [
                Expanded(
                  child: StatCard.dense(
                    label: 'موجودی کل',
                    value: MoneyText(
                      r.finance.totalBalance,
                      sign: MoneySign.signed,
                      suffix: ' ت',
                    ),
                  ),
                ),
                const SizedBox(width: Spacing.md),
                Expanded(
                  child: StatCard.dense(
                    label: 'وظایف انجام‌شده',
                    value: Text(
                      '${toPersianDigits('${r.tasks.completed}')} / ${toPersianDigits('${r.tasks.created}')}',
                    ),
                  ),
                ),
              ],
            ),
            if (r.finance.budgets.isNotEmpty) ...[
              const SectionHeader('بودجه‌ها'),
              for (final b in r.finance.budgets)
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
