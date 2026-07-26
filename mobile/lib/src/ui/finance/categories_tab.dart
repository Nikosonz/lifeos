import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../finance/finance_providers.dart';
import '../../generated/generated.dart';

class CategoriesTab extends ConsumerWidget {
  const CategoriesTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(categoriesProvider);
    return Scaffold(
      body: categories.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطا: $e')),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('هنوز دسته‌بندی‌ای نساخته‌اید.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(categoriesProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final c = list[i];
                final income = c.type == CategoryType.INCOME;
                return ListTile(
                  leading: Icon(
                    income ? Icons.arrow_downward : Icons.arrow_upward,
                    color: income ? Colors.green : Colors.red,
                  ),
                  title: Text(c.name),
                  subtitle: Text(income ? 'درآمد' : 'هزینه'),
                  onLongPress: () => _confirmDelete(context, ref, c),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateDialog(context, ref),
        child: const Icon(Icons.add),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, CategoryResponse c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('حذف «${c.name}»؟'),
        content: const Text('این عملیات قابل بازگشت نیست.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok == true) {
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
                decoration: const InputDecoration(labelText: 'نام', hintText: 'مثلاً خواربار'),
              ),
              const SizedBox(height: 16),
              SegmentedButton<CategoryType>(
                segments: const [
                  ButtonSegment(value: CategoryType.EXPENSE, label: Text('هزینه')),
                  ButtonSegment(value: CategoryType.INCOME, label: Text('درآمد')),
                ],
                selected: {type},
                onSelectionChanged: (s) => setState(() => type = s.first),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('انصراف')),
            FilledButton(
              onPressed: () => Navigator.pop(context, (controller.text.trim(), type)),
              child: const Text('ایجاد'),
            ),
          ],
        ),
      ),
    );
    if (result != null && result.$1.isNotEmpty) {
      await ref
          .read(financeRepositoryProvider)
          .createCategory(CategoryCreateInput(name: result.$1, type: result.$2));
      invalidateFinance(ref);
    }
  }
}
