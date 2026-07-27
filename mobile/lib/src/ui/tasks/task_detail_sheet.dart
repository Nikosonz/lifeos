import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../tasks/task_labels.dart';
import '../../tasks/tasks_providers.dart';
import '../../theme/tokens/spacing.dart';
import '../widgets/widgets.dart';
import 'task_form_dialog.dart';

Future<void> showTaskDetailSheet(
  BuildContext context,
  WidgetRef ref,
  TaskResponse task,
) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    builder: (context) => _TaskDetailSheet(task: task),
  );
}

class _TaskDetailSheet extends ConsumerWidget {
  final TaskResponse task;
  const _TaskDetailSheet({required this.task});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subtasks = ref.watch(subtasksProvider(task.id));
    final projects = ref.watch(projectsProvider).value ?? const [];

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.all(Spacing.lg),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    task.title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.edit_outlined),
                  onPressed: () {
                    Navigator.pop(context);
                    showTaskFormDialog(
                      context,
                      ref,
                      projects: projects,
                      task: task,
                    );
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () async {
                    final ok = await confirmDestructive(
                      context,
                      title: 'حذف این وظیفه؟',
                    );
                    if (ok) {
                      await ref
                          .read(tasksRepositoryProvider)
                          .deleteTask(task.id);
                      invalidateTasks(ref);
                      if (context.mounted) Navigator.pop(context);
                    }
                  },
                ),
              ],
            ),
            Wrap(
              spacing: Spacing.sm,
              children: [
                Chip(
                  label: Text(taskStatusLabel(task.status)),
                  backgroundColor: taskStatusColor(
                    context,
                    task.status,
                  ).withValues(alpha: 0.15),
                ),
                Chip(
                  label: Text(taskPriorityLabel(task.priority)),
                  backgroundColor: taskPriorityColor(
                    context,
                    task.priority,
                  ).withValues(alpha: 0.15),
                ),
              ],
            ),
            if (task.description != null) ...[
              const SizedBox(height: Spacing.md),
              Text(task.description!),
            ],
            const Divider(height: Spacing.xxl),
            Text('زیروظیفه‌ها', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: Spacing.sm),
            AsyncValueView(
              value: subtasks,
              onRetry: () => ref.invalidate(subtasksProvider(task.id)),
              isEmpty: (list) => list.isEmpty,
              empty: (context) => const Text('هنوز زیروظیفه‌ای ثبت نشده است.'),
              data: (context, list) => Column(
                children: [
                  for (final s in list)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: s.completed,
                      title: Text(
                        s.title,
                        style: s.completed
                            ? const TextStyle(
                                decoration: TextDecoration.lineThrough,
                              )
                            : null,
                      ),
                      secondary: IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20),
                        onPressed: () async {
                          final ok = await confirmDestructive(
                            context,
                            title: 'حذف «${s.title}»؟',
                          );
                          if (ok) {
                            await ref
                                .read(tasksRepositoryProvider)
                                .deleteSubtask(task.id, s.id);
                            ref.invalidate(subtasksProvider(task.id));
                          }
                        },
                      ),
                      onChanged: (v) async {
                        await ref
                            .read(tasksRepositoryProvider)
                            .toggleSubtask(task.id, s.id, v ?? false);
                        ref.invalidate(subtasksProvider(task.id));
                      },
                    ),
                ],
              ),
            ),
            const SizedBox(height: Spacing.sm),
            _AddSubtaskField(taskId: task.id),
          ],
        ),
      ),
    );
  }
}

class _AddSubtaskField extends ConsumerStatefulWidget {
  final String taskId;
  const _AddSubtaskField({required this.taskId});

  @override
  ConsumerState<_AddSubtaskField> createState() => _AddSubtaskFieldState();
}

class _AddSubtaskFieldState extends ConsumerState<_AddSubtaskField> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _controller.text.trim();
    if (title.isEmpty) return;
    _controller.clear();
    await ref.read(tasksRepositoryProvider).createSubtask(widget.taskId, title);
    ref.invalidate(subtasksProvider(widget.taskId));
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      decoration: InputDecoration(
        hintText: 'زیروظیفه جدید',
        suffixIcon: IconButton(icon: const Icon(Icons.add), onPressed: _submit),
      ),
      onSubmitted: (_) => _submit(),
    );
  }
}
