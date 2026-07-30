import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../tasks/tasks_providers.dart';
import '../../theme/module_colors.dart';
import '../../theme/tokens/spacing.dart';
import '../widgets/widgets.dart';

class LabelsTab extends ConsumerWidget {
  const LabelsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final labels = ref.watch(labelsProvider);
    return AppScaffold(
      onRefresh: () async => ref.invalidate(labelsProvider),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateDialog(context, ref),
        child: const Icon(Icons.add),
      ),
      body: AsyncValueView(
        value: labels,
        onRetry: () => ref.invalidate(labelsProvider),
        isEmpty: (list) => list.isEmpty,
        empty: (context) => EmptyState(
          icon: Icons.label_outline,
          module: ModuleKey.tasks,
          message: 'هنوز برچسبی نساخته‌اید.',
          hint: 'برچسب‌ها وظایف مشابه را به هم مرتبط می‌کنند.',
          actionLabel: 'ساخت برچسب',
          onAction: () => _showCreateDialog(context, ref),
        ),
        data: (context, list) => Wrap(
          spacing: Spacing.sm,
          runSpacing: Spacing.sm,
          children: [
            for (final l in list)
              InputChip(
                label: Text(l.name),
                onDeleted: () => _confirmDelete(context, ref, l),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    LabelResponse l,
  ) async {
    final ok = await confirmDestructive(context, title: 'حذف «${l.name}»؟');
    // The confirm dialog is an await: the user can navigate away while it is
    // open, so `context` is not guaranteed to still be mounted after it.
    if (!ok || !context.mounted) return;
    await runMutation(
      context,
      () => ref
          .read(tasksRepositoryProvider)
          .deleteLabel(l.id, expectedVersion: l.version),
    );
    ref.invalidate(labelsProvider);
  }

  Future<void> _showCreateDialog(BuildContext context, WidgetRef ref) async {
    final nameController = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('برچسب جدید'),
        content: TextField(
          controller: nameController,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'نام'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('انصراف'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, nameController.text.trim()),
            child: const Text('ایجاد'),
          ),
        ],
      ),
    );
    if (name != null && name.isNotEmpty) {
      await ref
          .read(tasksRepositoryProvider)
          .createLabel(LabelCreateInput(name: name));
      ref.invalidate(labelsProvider);
    }
  }
}
