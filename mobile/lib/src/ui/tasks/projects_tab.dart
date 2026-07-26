import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../tasks/tasks_providers.dart';

class ProjectsTab extends ConsumerWidget {
  const ProjectsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projects = ref.watch(projectsProvider);
    return Scaffold(
      body: projects.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطا: $e')),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('هنوز پروژه‌ای نساخته‌اید.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(projectsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final p = list[i];
                return ListTile(
                  leading: Icon(
                    Icons.folder_outlined,
                    color: p.color != null ? Color(int.parse(p.color!.replaceFirst('#', '0xff'))) : null,
                  ),
                  title: Text(p.name),
                  subtitle: p.description != null ? Text(p.description!) : null,
                  onLongPress: () => _confirmDelete(context, ref, p),
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

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, ProjectResponse p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('حذف «${p.name}»؟'),
        content: const Text('این عملیات قابل بازگشت نیست.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(tasksRepositoryProvider).deleteProject(p.id);
      ref.invalidate(projectsProvider);
    }
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
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('انصراف')),
          FilledButton(
            onPressed: () => Navigator.pop(context, nameController.text.trim()),
            child: const Text('ایجاد'),
          ),
        ],
      ),
    );
    if (name != null && name.isNotEmpty) {
      await ref.read(tasksRepositoryProvider).createProject(ProjectCreateInput(name: name));
      ref.invalidate(projectsProvider);
    }
  }
}
