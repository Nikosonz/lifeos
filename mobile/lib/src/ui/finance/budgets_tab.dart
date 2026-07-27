import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart'; // StateProvider — simple local UI state, not app data

import '../../finance/finance_providers.dart';
import '../../generated/generated.dart';
import '../../shared/format_jalali.dart';
import '../../shared/format_money.dart';
import '../../theme/module_colors.dart';
import '../../theme/semantic_colors.dart';
import '../../theme/tokens/shape.dart';
import '../../theme/tokens/spacing.dart';
import '../widgets/widgets.dart';

final _monthProvider = StateProvider.autoDispose<DashboardArgs>(
  (ref) => (null, null),
);

class BudgetsTab extends ConsumerWidget {
  const BudgetsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = ref.watch(_monthProvider);
    // args.$1/$2 come straight from the Jalali-year/month query the API
    // expects; DateTime.now()'s own .year/.month are Gregorian and must
    // never be used directly here — jalaliForInstant() is the same
    // Tehran-offset conversion every other date display in the app goes
    // through (see format_jalali.dart), not a fresh reimplementation.
    final now = jalaliForInstant(DateTime.now());
    final year = args.$1 ?? now.year;
    final month = args.$2 ?? now.month;
    final budgets = ref.watch(budgetsProvider(args));
    final categories = ref.watch(categoriesProvider).value ?? const [];
    final expenseCategories = categories
        .where((c) => c.type == CategoryType.EXPENSE)
        .toList();

    return AppScaffold(
      onRefresh: () async => ref.invalidate(budgetsProvider(args)),
      floatingActionButton: FloatingActionButton(
        onPressed: expenseCategories.isEmpty
            ? () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('ابتدا یک دسته‌بندی هزینه بسازید.'),
                ),
              )
            : () => _showCreateDialog(
                context,
                ref,
                expenseCategories,
                year,
                month,
                args,
              ),
        child: const Icon(Icons.add),
      ),
      body: AsyncValueView(
        value: budgets,
        onRetry: () => ref.invalidate(budgetsProvider(args)),
        isEmpty: (list) => list.isEmpty,
        empty: (context) => Column(
          children: [
            MonthStepper(
              year: year,
              month: month,
              onChanged: (ym) => ref.read(_monthProvider.notifier).state = ym,
            ),
            Expanded(
              child: EmptyState(
                icon: Icons.pie_chart_outline,
                module: ModuleKey.finance,
                message: 'برای این ماه بودجه‌ای تعریف نشده.',
                hint: 'سقف هزینه یک دسته‌بندی را برای این ماه مشخص کنید.',
                actionLabel: expenseCategories.isEmpty ? null : 'ساخت بودجه',
                onAction: expenseCategories.isEmpty
                    ? null
                    : () => _showCreateDialog(
                        context,
                        ref,
                        expenseCategories,
                        year,
                        month,
                        args,
                      ),
              ),
            ),
          ],
        ),
        data: (context, list) => ListView(
          children: [
            MonthStepper(
              year: year,
              month: month,
              onChanged: (ym) => ref.read(_monthProvider.notifier).state = ym,
            ),
            for (final b in list)
              Padding(
                padding: const EdgeInsets.only(bottom: Spacing.md),
                child: _BudgetCard(
                  budget: b,
                  categoryName: categories
                      .firstWhere((c) => c.id == b.categoryId)
                      .name,
                  onDelete: () async {
                    await ref
                        .read(financeRepositoryProvider)
                        .deleteBudget(b.id);
                    ref.invalidate(budgetsProvider(args));
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _showCreateDialog(
    BuildContext context,
    WidgetRef ref,
    List<CategoryResponse> categories,
    int year,
    int month,
    DashboardArgs args,
  ) async {
    final controller = TextEditingController();
    var categoryId = categories.first.id;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text('بودجه برای ${jalaliMonthLabel(year, month, fa: true)}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: categoryId,
                decoration: const InputDecoration(labelText: 'دسته‌بندی'),
                items: [
                  for (final c in categories)
                    DropdownMenuItem(value: c.id, child: Text(c.name)),
                ],
                onChanged: (v) => setState(() => categoryId = v!),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'سقف بودجه (تومان)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('انصراف'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('ثبت'),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      await ref
          .read(financeRepositoryProvider)
          .createBudget(
            BudgetCreateInput(
              categoryId: categoryId,
              jalaliYear: year,
              jalaliMonth: month,
              limitAmount: parseTomanInputToRial(controller.text),
              currency: Currency.IRR,
            ),
          );
      ref.invalidate(budgetsProvider(args));
    }
  }
}

class _BudgetCard extends StatelessWidget {
  final BudgetResponse budget;
  final String categoryName;
  final VoidCallback onDelete;
  const _BudgetCard({
    required this.budget,
    required this.categoryName,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final limit = BigInt.parse(budget.limitAmount);
    final spent = BigInt.parse(budget.spent);
    final ratio = limit == BigInt.zero ? 0.0 : (spent / limit).clamp(0.0, 1.0);
    final overspent = budget.remaining.startsWith('-');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Spacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    categoryName,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 20),
                  onPressed: onDelete,
                ),
              ],
            ),
            const SizedBox(height: Spacing.sm),
            ClipRRect(
              borderRadius: AppShape.sm,
              child: LinearProgressIndicator(
                value: ratio,
                minHeight: 8,
                color: overspent ? context.colors.expense : null,
              ),
            ),
            const SizedBox(height: Spacing.sm),
            Row(
              children: [
                Text(
                  '${formatTomanFromRial(budget.spent, fa: true)} از '
                  '${formatTomanFromRial(budget.limitAmount, fa: true)} تومان'
                  ' — ${overspent ? 'بیش از سقف' : 'باقیمانده'}: ',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.colors.neutralCaption,
                  ),
                ),
                MoneyText(
                  budget.remaining,
                  sign: MoneySign.signed,
                  suffix: '',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
