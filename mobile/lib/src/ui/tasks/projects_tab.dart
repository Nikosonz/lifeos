import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../tasks/tasks_providers.dart';
import '../../theme/module_colors.dart';
import '../widgets/widgets.dart';

class ProjectsTab extends ConsumerWidget {
  const ProjectsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projects = ref.watch(projectsProvider);
    return AppScaffold(
      onRefresh: () async => ref.invalidate(projectsProvider),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateDialog(context, ref),
        child: const Icon(Icons.add),
      ),
      body: AsyncValueView(
        value: projects,
        onRetry: () => ref.invalidate(projectsProvider),
        skeleton: (context) => const SkeletonList(),
        isEmpty: (list) => list.isEmpty,
        empty: (context) => EmptyState(
          icon: Icons.folder_outlined,
          module: ModuleKey.tasks,
          message: 'هنوز پروژه‌ای نساخته‌اید.',
          hint: 'وظایف را در یک پروژه دسته‌بندی کنید.',
          actionLabel: 'ساخت پروژه',
          onAction: () => _showCreateDialog(context, ref),
        ),
        data: (context, list) => ListView.builder(
          itemCount: list.length,
          itemBuilder: (context, i) {
            final p = list[i];
            final customColor = p.color != null
                ? Color(int.parse(p.color!.replaceFirst('#', '0xff')))
                : null;
            return AppListRow(
              leadingIcon: Icons.folder_outlined,
              module: ModuleKey.tasks,
              accent: customColor,
              accentSubtle: customColor != null
                  ? subtleTint(
                      customColor,
                      brightness: Theme.of(context).brightness,
                    )
                  : null,
              title: Text(p.name),
              subtitle: p.description != null ? Text(p.description!) : null,
              actions: [
                RowAction(
                  label: 'حذف',
                  icon: Icons.delete_outline,
                  destructive: true,
                  onTap: () => _confirmDelete(context, ref, p),
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
    ProjectResponse p,
  ) async {
    final ok = await confirmDestructive(context, title: 'حذف «${p.name}»؟');
    // The confirm dialog is an await: the user can navigate away while it is
    // open, so `context` is not guaranteed to still be mounted after it.
    if (!ok || !context.mounted) return;
    await runMutation(
      context,
      () => ref
          .read(tasksRepositoryProvider)
          .deleteProject(p.id, expectedVersion: p.version),
    );
    ref.invalidate(projectsProvider);
  }

  Future<void> _showCreateDialog(BuildContext context, WidgetRef ref) async {
    final nameController = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('پروژه جدید'),
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
          .createProject(ProjectCreateInput(name: name));
      ref.invalidate(projectsProvider);
    }
  }
}
