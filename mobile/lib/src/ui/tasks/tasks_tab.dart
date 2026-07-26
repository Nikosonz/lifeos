import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../../generated/generated.dart';
import '../../shared/format_jalali.dart';
import '../../tasks/task_labels.dart';
import '../../tasks/tasks_providers.dart';
import 'task_detail_sheet.dart';
import 'task_form_dialog.dart';

final _statusFilterProvider = StateProvider.autoDispose<TaskStatus?>((ref) => null);

class TasksTab extends ConsumerWidget {
  const TasksTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(_statusFilterProvider);
    final page = ref.watch(tasksProvider(status));
    final projects = ref.watch(projectsProvider).value ?? const [];
    final projectName = {for (final p in projects) p.id: p.name};

    return Scaffold(
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _StatusChip(label: 'همه', selected: status == null, onTap: () => ref.read(_statusFilterProvider.notifier).state = null),
                for (final s in TaskStatus.values)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 8),
                    child: _StatusChip(
                      label: taskStatusLabel(s),
                      selected: status == s,
                      onTap: () => ref.read(_statusFilterProvider.notifier).state = s,
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: page.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('خطا: $e')),
              data: (data) {
                if (data.items.isEmpty) {
                  return const Center(child: Text('هنوز وظیفه‌ای ثبت نشده است.'));
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(tasksProvider(status)),
                  child: NotificationListener<ScrollEndNotification>(
                    onNotification: (n) {
                      if (n.metrics.extentAfter < 200) {
                        ref.read(tasksProvider(status).notifier).loadMore();
                      }
                      return false;
                    },
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: data.items.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final t = data.items[i];
                        return ListTile(
                          leading: Icon(Icons.circle, size: 12, color: taskStatusColor(t.status)),
                          title: Text(
                            t.title,
                            style: t.status == TaskStatus.DONE ? const TextStyle(decoration: TextDecoration.lineThrough) : null,
                          ),
                          subtitle: Text([
                            if (t.projectId != null) projectName[t.projectId] ?? '',
                            if (t.deadline != null) 'مهلت: ${formatJalaliDate(t.deadline!, fa: true)}',
                          ].where((s) => s.isNotEmpty).join(' · ')),
                          trailing: Chip(
                            label: Text(taskPriorityLabel(t.priority), style: const TextStyle(fontSize: 11)),
                            backgroundColor: taskPriorityColor(t.priority).withValues(alpha: 0.15),
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ),
                          onTap: () => showTaskDetailSheet(context, ref, t),
                        );
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
        onPressed: () => showTaskFormDialog(context, ref, projects: projects),
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _StatusChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap());
}
