import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../generated/generated.dart';
import '../providers.dart';
import 'tasks_repository.dart';

final tasksRepositoryProvider = Provider<TasksRepository>(
  (ref) => TasksRepository(ref.read(apiClientProvider)),
);

typedef TaskPage = ({List<TaskResponse> items, String? nextCursor});

/// Cursor-paginated task list, filtered by [status] — same shape/semantics
/// as GET /api/v1/tasks?status=&cursor=. A status change creates a brand
/// new provider instance (via .family), which is exactly the "start over
/// from page 1 under the new filter" behavior a filter switch should have.
/// Riverpod 3's class-based family threads the family arg through the
/// constructor (not a `build(arg)` parameter, unlike functional families).
class TasksController extends AsyncNotifier<TaskPage> {
  final TaskStatus? status;
  TasksController(this.status);

  @override
  Future<TaskPage> build() => ref.read(tasksRepositoryProvider).listTasks(status: status);

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.nextCursor == null) return;
    final more = await ref.read(tasksRepositoryProvider).listTasks(status: status, cursor: current.nextCursor);
    state = AsyncData((items: [...current.items, ...more.items], nextCursor: more.nextCursor));
  }
}

final tasksProvider = AsyncNotifierProvider.autoDispose.family<TasksController, TaskPage, TaskStatus?>(
  TasksController.new,
);

final projectsProvider = FutureProvider.autoDispose<List<ProjectResponse>>(
  (ref) => ref.read(tasksRepositoryProvider).listProjects(),
);

final labelsProvider = FutureProvider.autoDispose<List<LabelResponse>>(
  (ref) => ref.read(tasksRepositoryProvider).listLabels(),
);

final subtasksProvider = FutureProvider.autoDispose.family<List<SubtaskResponse>, String>(
  (ref, taskId) => ref.read(tasksRepositoryProvider).listSubtasks(taskId),
);

/// Invalidates every filtered instance of the task list family at once
/// (invalidating the family itself, not one .call(arg) member) — a mutation
/// can change which filter(s) a task belongs under (e.g. TODO -> DONE), so
/// only invalidating the caller's current filter would leave the others stale.
void invalidateTasks(WidgetRef ref) {
  ref.invalidate(tasksProvider);
  ref.invalidate(projectsProvider);
  ref.invalidate(labelsProvider);
}
