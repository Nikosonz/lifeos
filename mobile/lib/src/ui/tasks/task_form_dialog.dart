import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../shared/format_jalali.dart';
import '../../tasks/task_labels.dart';
import '../../tasks/tasks_providers.dart';

/// Create (task == null) or edit (task != null) — one form, since every
/// field is the same set either way (title/description/status/priority/
/// project/deadline/labels).
Future<void> showTaskFormDialog(
  BuildContext context,
  WidgetRef ref, {
  required List<ProjectResponse> projects,
  TaskResponse? task,
}) async {
  final labels = ref.read(labelsProvider).value ?? const [];
  final titleController = TextEditingController(text: task?.title ?? '');
  final descController = TextEditingController(text: task?.description ?? '');
  var status = task?.status ?? TaskStatus.TODO;
  var priority = task?.priority ?? TaskPriority.MEDIUM;
  String? projectId = task?.projectId;
  DateTime? deadline = task?.deadline;
  final labelIds = {...?task?.labelIds};

  final saved = await showDialog<bool>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: Text(task == null ? 'وظیفه جدید' : 'ویرایش وظیفه'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(controller: titleController, autofocus: true, decoration: const InputDecoration(labelText: 'عنوان')),
              const SizedBox(height: 12),
              TextField(
                controller: descController,
                decoration: const InputDecoration(labelText: 'توضیحات (اختیاری)'),
                minLines: 1,
                maxLines: 3,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<TaskStatus>(
                initialValue: status,
                decoration: const InputDecoration(labelText: 'وضعیت'),
                items: [for (final s in TaskStatus.values) DropdownMenuItem(value: s, child: Text(taskStatusLabel(s)))],
                onChanged: (v) => setState(() => status = v!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<TaskPriority>(
                initialValue: priority,
                decoration: const InputDecoration(labelText: 'اولویت'),
                items: [for (final p in TaskPriority.values) DropdownMenuItem(value: p, child: Text(taskPriorityLabel(p)))],
                onChanged: (v) => setState(() => priority = v!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: projectId,
                decoration: const InputDecoration(labelText: 'پروژه'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('بدون پروژه')),
                  for (final p in projects) DropdownMenuItem(value: p.id, child: Text(p.name)),
                ],
                onChanged: (v) => setState(() => projectId = v),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(deadline == null ? 'بدون مهلت' : 'مهلت: ${formatJalaliDate(deadline!, fa: true)}'),
                trailing: Wrap(
                  children: [
                    if (deadline != null) IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () => setState(() => deadline = null)),
                    const Icon(Icons.calendar_today, size: 18),
                  ],
                ),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: deadline ?? DateTime.now(),
                    firstDate: DateTime(2015),
                    lastDate: DateTime(2100),
                  );
                  if (picked != null) setState(() => deadline = picked);
                },
              ),
              if (labels.isNotEmpty) ...[
                const SizedBox(height: 8),
                Align(alignment: AlignmentDirectional.centerStart, child: Text('برچسب‌ها', style: Theme.of(context).textTheme.labelLarge)),
                Wrap(
                  spacing: 6,
                  children: [
                    for (final l in labels)
                      FilterChip(
                        label: Text(l.name),
                        selected: labelIds.contains(l.id),
                        onSelected: (v) => setState(() => v ? labelIds.add(l.id) : labelIds.remove(l.id)),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
          FilledButton(
            onPressed: titleController.text.trim().isEmpty ? null : () => Navigator.pop(context, true),
            child: Text(task == null ? 'ایجاد' : 'ذخیره'),
          ),
        ],
      ),
    ),
  );

  if (saved != true) return;
  final title = titleController.text.trim();
  if (title.isEmpty) return;
  final description = descController.text.trim().isEmpty ? null : descController.text.trim();

  if (task == null) {
    await ref.read(tasksRepositoryProvider).createTask(TaskCreateInput(
      title: title,
      description: description,
      status: status,
      priority: priority,
      projectId: projectId,
      deadline: deadline,
      labelIds: labelIds.toList(),
    ));
  } else {
    await ref.read(tasksRepositoryProvider).updateTask(
      task.id,
      TaskUpdateInput(
        title: title,
        description: description,
        status: status,
        priority: priority,
        projectId: projectId,
        deadline: deadline,
        labelIds: labelIds.toList(),
      ),
    );
  }
  invalidateTasks(ref);
}
