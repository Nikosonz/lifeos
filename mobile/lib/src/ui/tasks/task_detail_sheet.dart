import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../tasks/task_labels.dart';
import '../../tasks/tasks_providers.dart';
import 'task_form_dialog.dart';

Future<void> showTaskDetailSheet(BuildContext context, WidgetRef ref, TaskResponse task) {
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
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.all(20),
          children: [
            Row(
              children: [
                Expanded(child: Text(task.title, style: Theme.of(context).textTheme.titleLarge)),
                IconButton(
                  icon: const Icon(Icons.edit_outlined),
                  onPressed: () {
                    Navigator.pop(context);
                    showTaskFormDialog(context, ref, projects: projects, task: task);
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('حذف این وظیفه؟'),
                        content: const Text('این عملیات قابل بازگشت نیست.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
                          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف')),
                        ],
                      ),
                    );
                    if (ok == true) {
                      await ref.read(tasksRepositoryProvider).deleteTask(task.id);
                      invalidateTasks(ref);
                      if (context.mounted) Navigator.pop(context);
                    }
                  },
                ),
              ],
            ),
            Wrap(
              spacing: 8,
              children: [
                Chip(label: Text(taskStatusLabel(task.status)), backgroundColor: taskStatusColor(task.status).withValues(alpha: 0.15)),
                Chip(label: Text(taskPriorityLabel(task.priority)), backgroundColor: taskPriorityColor(task.priority).withValues(alpha: 0.15)),
              ],
            ),
            if (task.description != null) ...[
              const SizedBox(height: 12),
              Text(task.description!),
            ],
            const Divider(height: 32),
            Text('زیروظیفه‌ها', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            subtasks.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Text('خطا: $e'),
              data: (list) => Column(
                children: [
                  for (final s in list)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: s.completed,
                      title: Text(
                        s.title,
                        style: s.completed ? const TextStyle(decoration: TextDecoration.lineThrough) : null,
                      ),
                      secondary: IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20),
                        onPressed: () async {
                          await ref.read(tasksRepositoryProvider).deleteSubtask(task.id, s.id);
                          ref.invalidate(subtasksProvider(task.id));
                        },
                      ),
                      onChanged: (v) async {
                        await ref.read(tasksRepositoryProvider).toggleSubtask(task.id, s.id, v ?? false);
                        ref.invalidate(subtasksProvider(task.id));
                      },
                    ),
                  if (list.isEmpty) const Text('هنوز زیروظیفه‌ای ثبت نشده است.'),
                ],
              ),
            ),
            const SizedBox(height: 8),
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
