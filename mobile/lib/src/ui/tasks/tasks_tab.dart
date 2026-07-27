import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../../generated/generated.dart';
import '../../shared/format_jalali.dart';
import '../../tasks/task_labels.dart';
import '../../tasks/tasks_providers.dart';
import '../../theme/module_colors.dart';
import '../widgets/widgets.dart';
import 'task_detail_sheet.dart';
import 'task_form_dialog.dart';

final _statusFilterProvider = StateProvider.autoDispose<TaskStatus?>(
  (ref) => null,
);

class TasksTab extends ConsumerWidget {
  const TasksTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(_statusFilterProvider);
    final page = ref.watch(tasksProvider(status));
    final projects = ref.watch(projectsProvider).value ?? const [];
    final projectName = {for (final p in projects) p.id: p.name};

    return AppScaffold(
      onRefresh: () async => ref.invalidate(tasksProvider(status)),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showTaskFormDialog(context, ref, projects: projects),
        child: const Icon(Icons.add),
      ),
      body: AsyncValueView(
        value: page,
        onRetry: () => ref.invalidate(tasksProvider(status)),
        isEmpty: (data) => data.items.isEmpty,
        empty: (context) => Column(
          children: [
            _StatusFilterRow(status: status, ref: ref),
            Expanded(
              child: EmptyState(
                icon: Icons.checklist_outlined,
                module: ModuleKey.tasks,
                message: 'هنوز وظیفه‌ای ثبت نشده است.',
                hint: 'اولین وظیفه خود را از دکمه‌ی زیر ثبت کنید.',
              ),
            ),
          ],
        ),
        data: (context, data) => NotificationListener<ScrollEndNotification>(
          onNotification: (n) {
            if (n.metrics.extentAfter < 200) {
              ref.read(tasksProvider(status).notifier).loadMore();
            }
            return false;
          },
          child: ListView(
            children: [
              _StatusFilterRow(status: status, ref: ref),
              for (final t in data.items)
                AppListRow(
                  leadingIcon: Icons.circle,
                  accent: taskStatusColor(context, t.status),
                  accentSubtle: subtleTint(
                    taskStatusColor(context, t.status),
                    brightness: Theme.of(context).brightness,
                  ),
                  title: Text(
                    t.title,
                    style: t.status == TaskStatus.DONE
                        ? const TextStyle(
                            decoration: TextDecoration.lineThrough,
                          )
                        : null,
                  ),
                  subtitle: Text(
                    [
                      if (t.projectId != null) projectName[t.projectId] ?? '',
                      if (t.deadline != null)
                        'مهلت: ${formatJalaliDate(t.deadline!, fa: true)}',
                    ].where((s) => s.isNotEmpty).join(' · '),
                  ),
                  trailing: Chip(
                    label: Text(
                      taskPriorityLabel(t.priority),
                      style: const TextStyle(fontSize: 11),
                    ),
                    backgroundColor: taskPriorityColor(
                      context,
                      t.priority,
                    ).withValues(alpha: 0.15),
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                  ),
                  onTap: () => showTaskDetailSheet(context, ref, t),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusFilterRow extends StatelessWidget {
  const _StatusFilterRow({required this.status, required this.ref});

  final TaskStatus? status;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          _StatusChip(
            label: 'همه',
            selected: status == null,
            onTap: () => ref.read(_statusFilterProvider.notifier).state = null,
          ),
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
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _StatusChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => ChoiceChip(
    label: Text(label),
    selected: selected,
    onSelected: (_) => onTap(),
  );
}
