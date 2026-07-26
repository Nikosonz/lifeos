import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../tasks/tasks_providers.dart';

class LabelsTab extends ConsumerWidget {
  const LabelsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final labels = ref.watch(labelsProvider);
    return Scaffold(
      body: labels.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطا: $e')),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('هنوز برچسبی نساخته‌اید.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(labelsProvider),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final l in list)
                    InputChip(
                      label: Text(l.name),
                      onDeleted: () async {
                        await ref.read(tasksRepositoryProvider).deleteLabel(l.id);
                        ref.invalidate(labelsProvider);
                      },
                    ),
                ],
              ),
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
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('انصراف')),
          FilledButton(
            onPressed: () => Navigator.pop(context, nameController.text.trim()),
            child: const Text('ایجاد'),
          ),
        ],
      ),
    );
    if (name != null && name.isNotEmpty) {
      await ref.read(tasksRepositoryProvider).createLabel(LabelCreateInput(name: name));
      ref.invalidate(labelsProvider);
    }
  }
}
