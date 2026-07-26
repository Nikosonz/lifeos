import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../generated/generated.dart';

/// Thin client over /api/v1/tasks/* — no business logic (Rule 1).
class TasksRepository {
  final ApiClient _api;
  TasksRepository(this._api);

  static const _uuid = Uuid();

  // --- Tasks ---

  Future<({List<TaskResponse> items, String? nextCursor})> listTasks({
    String? cursor,
    int limit = 20,
    TaskStatus? status,
    String? projectId,
    String? labelId,
  }) async {
    final data = await _api.get('/api/v1/tasks', query: {
      'cursor': ?cursor,
      'limit': limit,
      'status': ?status?.name,
      'projectId': ?projectId,
      'labelId': ?labelId,
    });
    final items = (data['items'] as List<dynamic>).cast<Map<String, dynamic>>().map(TaskResponse.fromJson).toList();
    return (items: items, nextCursor: data['nextCursor'] as String?);
  }

  Future<TaskResponse> createTask(TaskCreateInput input) async {
    final data = await _api.post('/api/v1/tasks', body: input.toJson(), idempotencyKey: _uuid.v4());
    return TaskResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<TaskResponse> updateTask(String id, TaskUpdateInput input) async {
    final data = await _api.patch('/api/v1/tasks/$id', body: input.toJson());
    return TaskResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteTask(String id) async {
    await _api.delete('/api/v1/tasks/$id');
  }

  // --- Subtasks ---

  Future<List<SubtaskResponse>> listSubtasks(String taskId) async {
    final data = await _api.get('/api/v1/tasks/$taskId/subtasks');
    return (data['subtasks'] as List<dynamic>).cast<Map<String, dynamic>>().map(SubtaskResponse.fromJson).toList();
  }

  Future<SubtaskResponse> createSubtask(String taskId, String title) async {
    final data = await _api.post('/api/v1/tasks/$taskId/subtasks', body: SubtaskCreateInput(title: title).toJson());
    return SubtaskResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<SubtaskResponse> toggleSubtask(String taskId, String subtaskId, bool completed) async {
    final data = await _api.patch(
      '/api/v1/tasks/$taskId/subtasks/$subtaskId',
      body: SubtaskUpdateInput(completed: completed).toJson(),
    );
    return SubtaskResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteSubtask(String taskId, String subtaskId) async {
    await _api.delete('/api/v1/tasks/$taskId/subtasks/$subtaskId');
  }

  // --- Projects ---

  Future<List<ProjectResponse>> listProjects() async {
    final data = await _api.get('/api/v1/tasks/projects');
    return (data['projects'] as List<dynamic>).cast<Map<String, dynamic>>().map(ProjectResponse.fromJson).toList();
  }

  Future<ProjectResponse> createProject(ProjectCreateInput input) async {
    final data = await _api.post('/api/v1/tasks/projects', body: input.toJson());
    return ProjectResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteProject(String id) async {
    await _api.delete('/api/v1/tasks/projects/$id');
  }

  // --- Labels ---

  Future<List<LabelResponse>> listLabels() async {
    final data = await _api.get('/api/v1/tasks/labels');
    return (data['labels'] as List<dynamic>).cast<Map<String, dynamic>>().map(LabelResponse.fromJson).toList();
  }

  Future<LabelResponse> createLabel(LabelCreateInput input) async {
    final data = await _api.post('/api/v1/tasks/labels', body: input.toJson());
    return LabelResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteLabel(String id) async {
    await _api.delete('/api/v1/tasks/labels/$id');
  }
}
