import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../finance/finance_providers.dart';
import '../../generated/generated.dart';
import '../../theme/module_colors.dart';
import '../../theme/semantic_colors.dart';
import '../widgets/widgets.dart';

class CategoriesTab extends ConsumerWidget {
  const CategoriesTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(categoriesProvider);
    return AppScaffold(
      onRefresh: () async => ref.invalidate(categoriesProvider),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateDialog(context, ref),
        child: const Icon(Icons.add),
      ),
      body: AsyncValueView(
        value: categories,
        onRetry: () => ref.invalidate(categoriesProvider),
        isEmpty: (list) => list.isEmpty,
        empty: (context) => EmptyState(
          icon: Icons.category_outlined,
          module: ModuleKey.finance,
          message: 'هنوز دسته‌بندی‌ای نساخته‌اید.',
          hint: 'برای ثبت تراکنش، ابتدا یک دسته‌بندی بسازید.',
          actionLabel: 'ساخت دسته‌بندی',
          onAction: () => _showCreateDialog(context, ref),
        ),
        data: (context, list) => ListView.builder(
          itemCount: list.length,
          itemBuilder: (context, i) {
            final c = list[i];
            final income = c.type == CategoryType.INCOME;
            return AppListRow(
              leadingIcon: income ? Icons.arrow_downward : Icons.arrow_upward,
              accent: income ? context.colors.income : context.colors.expense,
              accentSubtle: income
                  ? context.incomeSubtle
                  : context.expenseSubtle,
              title: Text(c.name),
              subtitle: Text(income ? 'درآمد' : 'هزینه'),
              actions: [
                RowAction(
                  label: 'حذف',
                  icon: Icons.delete_outline,
                  destructive: true,
                  onTap: () => _confirmDelete(context, ref, c),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    CategoryResponse c,
  ) async {
    final ok = await confirmDestructive(context, title: 'حذف «${c.name}»؟');
    if (ok) {
      await ref.read(financeRepositoryProvider).deleteCategory(c.id);
      invalidateFinance(ref);
    }
  }

  Future<void> _showCreateDialog(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    var type = CategoryType.EXPENSE;
    final result = await showDialog<(String, CategoryType)>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('دسته‌بندی جدید'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: controller,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'نام',
                  hintText: 'مثلاً خواربار',
                ),
              ),
              const SizedBox(height: 16),
              SegmentedButton<CategoryType>(
                segments: const [
                  ButtonSegment(
                    value: CategoryType.EXPENSE,
                    label: Text('هزینه'),
                  ),
                  ButtonSegment(
                    value: CategoryType.INCOME,
                    label: Text('درآمد'),
                  ),
                ],
                selected: {type},
                onSelectionChanged: (s) => setState(() => type = s.first),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('انصراف'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.pop(context, (controller.text.trim(), type)),
              child: const Text('ایجاد'),
            ),
          ],
        ),
      ),
    );
    if (result != null && result.$1.isNotEmpty) {
      await ref
          .read(financeRepositoryProvider)
          .createCategory(
            CategoryCreateInput(name: result.$1, type: result.$2),
          );
      invalidateFinance(ref);
    }
  }
}
