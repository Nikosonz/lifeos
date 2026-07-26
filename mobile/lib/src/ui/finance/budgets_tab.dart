import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart'; // StateProvider — simple local UI state, not app data

import '../../finance/finance_providers.dart';
import '../../generated/generated.dart';
import '../../shared/format_jalali.dart';
import '../../shared/format_money.dart';

final _monthProvider = StateProvider.autoDispose<DashboardArgs>((ref) => (null, null));

class BudgetsTab extends ConsumerWidget {
  const BudgetsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = ref.watch(_monthProvider);
    final now = DateTime.now();
    final year = args.$1 ?? now.year;
    final month = args.$2 ?? now.month;
    final budgets = ref.watch(budgetsProvider(args));
    final categories = ref.watch(categoriesProvider).value ?? const [];
    final expenseCategories = categories.where((c) => c.type == CategoryType.EXPENSE).toList();

    return Scaffold(
      body: Column(
        children: [
          _MonthNav(
            year: year,
            month: month,
            onChanged: (y, m) => ref.read(_monthProvider.notifier).state = (y, m),
          ),
          Expanded(
            child: budgets.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('خطا: $e')),
              data: (list) {
                if (list.isEmpty) {
                  return const Center(child: Text('برای این ماه بودجه‌ای تعریف نشده.'));
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(budgetsProvider(args)),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, i) => _BudgetCard(
                      budget: list[i],
                      categoryName: categories.firstWhere((c) => c.id == list[i].categoryId).name,
                      onDelete: () async {
                        await ref.read(financeRepositoryProvider).deleteBudget(list[i].id);
                        ref.invalidate(budgetsProvider(args));
                      },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: expenseCategories.isEmpty
            ? () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('ابتدا یک دسته‌بندی هزینه بسازید.')),
              )
            : () => _showCreateDialog(context, ref, expenseCategories, year, month, args),
        child: const Icon(Icons.add),
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
                items: [for (final c in categories) DropdownMenuItem(value: c.id, child: Text(c.name))],
                onChanged: (v) => setState(() => categoryId = v!),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'سقف بودجه (تومان)'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('ثبت')),
          ],
        ),
      ),
    );
    if (ok == true) {
      await ref.read(financeRepositoryProvider).createBudget(
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

class _MonthNav extends StatelessWidget {
  final int year;
  final int month;
  final void Function(int year, int month) onChanged;
  const _MonthNav({required this.year, required this.month, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: () => onChanged(month == 1 ? year - 1 : year, month == 1 ? 12 : month - 1),
          ),
          Text(jalaliMonthLabel(year, month, fa: true), style: Theme.of(context).textTheme.titleMedium),
          IconButton(
            icon: const Icon(Icons.chevron_left),
            onPressed: () => onChanged(month == 12 ? year + 1 : year, month == 12 ? 1 : month + 1),
          ),
        ],
      ),
    );
  }
}

class _BudgetCard extends StatelessWidget {
  final BudgetResponse budget;
  final String categoryName;
  final VoidCallback onDelete;
  const _BudgetCard({required this.budget, required this.categoryName, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final limit = BigInt.parse(budget.limitAmount);
    final spent = BigInt.parse(budget.spent);
    final ratio = limit == BigInt.zero ? 0.0 : (spent / limit).clamp(0.0, 1.0);
    final overspent = budget.remaining.startsWith('-');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(categoryName, style: Theme.of(context).textTheme.titleMedium),
                ),
                IconButton(icon: const Icon(Icons.delete_outline, size: 20), onPressed: onDelete),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: ratio,
                minHeight: 8,
                color: overspent ? Theme.of(context).colorScheme.error : null,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${formatTomanFromRial(budget.spent, fa: true)} از ${formatTomanFromRial(budget.limitAmount, fa: true)} تومان'
              ' — ${overspent ? 'بیش از سقف' : 'باقیمانده'}: ${formatTomanFromRial(budget.remaining, fa: true)}',
              style: TextStyle(
                fontSize: 13,
                color: overspent ? Theme.of(context).colorScheme.error : Colors.grey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
