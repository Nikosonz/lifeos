// GENERATED CODE - DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:dart -w @lifeos/contracts
// Source of truth: packages/contracts/src/**/schemas.ts (Zod).
// ignore_for_file: constant_identifier_names
// (enum members are named to match the wire values exactly, e.g. TaskStatus.IN_PROGRESS,
// so .name round-trips through toJson/fromJson without a lookup table.)

class LabelCreateInput {
  final String name;
  final String? color;

  const LabelCreateInput({
    required this.name,
    this.color,
  });

  factory LabelCreateInput.fromJson(Map<String, dynamic> json) => LabelCreateInput(
    name: json['name'] as String,
    color: json['color'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'name': name,
    'color': color,
  };
}

class LabelListResponse {
  final List<LabelResponse> labels;

  const LabelListResponse({
    required this.labels,
  });

  factory LabelListResponse.fromJson(Map<String, dynamic> json) => LabelListResponse(
    labels: (json['labels'] as List<dynamic>).map((e) => LabelResponse.fromJson(e as Map<String, dynamic>)).toList(),
  );

  Map<String, dynamic> toJson() => {
    'labels': labels.map((e) => e.toJson()).toList(),
  };
}

class LabelResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String name;
  final String? color;

  const LabelResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    required this.name,
    this.color,
  });

  factory LabelResponse.fromJson(Map<String, dynamic> json) => LabelResponse(
    id: json['id'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    deletedAt: json['deletedAt'] == null ? null : DateTime.parse(json['deletedAt'] as String),
    version: json['version'] as int,
    userId: json['userId'] as String,
    name: json['name'] as String,
    color: json['color'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'userId': userId,
    'name': name,
    'color': color,
  };
}

class LabelUpdateInput {
  final String? name;
  final String? color;

  const LabelUpdateInput({
    this.name,
    this.color,
  });

  factory LabelUpdateInput.fromJson(Map<String, dynamic> json) => LabelUpdateInput(
    name: json['name'] as String?,
    color: json['color'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'name': name,
    'color': color,
  };
}

class ProjectCreateInput {
  final String name;
  final String? description;
  final String? color;

  const ProjectCreateInput({
    required this.name,
    this.description,
    this.color,
  });

  factory ProjectCreateInput.fromJson(Map<String, dynamic> json) => ProjectCreateInput(
    name: json['name'] as String,
    description: json['description'] as String?,
    color: json['color'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'name': name,
    'description': description,
    'color': color,
  };
}

class ProjectListResponse {
  final List<ProjectResponse> projects;

  const ProjectListResponse({
    required this.projects,
  });

  factory ProjectListResponse.fromJson(Map<String, dynamic> json) => ProjectListResponse(
    projects: (json['projects'] as List<dynamic>).map((e) => ProjectResponse.fromJson(e as Map<String, dynamic>)).toList(),
  );

  Map<String, dynamic> toJson() => {
    'projects': projects.map((e) => e.toJson()).toList(),
  };
}

class ProjectResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String name;
  final String? description;
  final String? color;

  const ProjectResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    required this.name,
    this.description,
    this.color,
  });

  factory ProjectResponse.fromJson(Map<String, dynamic> json) => ProjectResponse(
    id: json['id'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    deletedAt: json['deletedAt'] == null ? null : DateTime.parse(json['deletedAt'] as String),
    version: json['version'] as int,
    userId: json['userId'] as String,
    name: json['name'] as String,
    description: json['description'] as String?,
    color: json['color'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'userId': userId,
    'name': name,
    'description': description,
    'color': color,
  };
}

class ProjectUpdateInput {
  final String? name;
  final String? description;
  final String? color;

  const ProjectUpdateInput({
    this.name,
    this.description,
    this.color,
  });

  factory ProjectUpdateInput.fromJson(Map<String, dynamic> json) => ProjectUpdateInput(
    name: json['name'] as String?,
    description: json['description'] as String?,
    color: json['color'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'name': name,
    'description': description,
    'color': color,
  };
}

class SubtaskCreateInput {
  final String title;

  const SubtaskCreateInput({
    required this.title,
  });

  factory SubtaskCreateInput.fromJson(Map<String, dynamic> json) => SubtaskCreateInput(
    title: json['title'] as String,
  );

  Map<String, dynamic> toJson() => {
    'title': title,
  };
}

class SubtaskListResponse {
  final List<SubtaskResponse> subtasks;

  const SubtaskListResponse({
    required this.subtasks,
  });

  factory SubtaskListResponse.fromJson(Map<String, dynamic> json) => SubtaskListResponse(
    subtasks: (json['subtasks'] as List<dynamic>).map((e) => SubtaskResponse.fromJson(e as Map<String, dynamic>)).toList(),
  );

  Map<String, dynamic> toJson() => {
    'subtasks': subtasks.map((e) => e.toJson()).toList(),
  };
}

class SubtaskResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String taskId;
  final String userId;
  final String title;
  final bool completed;
  final double position;

  const SubtaskResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.taskId,
    required this.userId,
    required this.title,
    required this.completed,
    required this.position,
  });

  factory SubtaskResponse.fromJson(Map<String, dynamic> json) => SubtaskResponse(
    id: json['id'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    deletedAt: json['deletedAt'] == null ? null : DateTime.parse(json['deletedAt'] as String),
    version: json['version'] as int,
    taskId: json['taskId'] as String,
    userId: json['userId'] as String,
    title: json['title'] as String,
    completed: json['completed'] as bool,
    position: (json['position'] as num).toDouble(),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'taskId': taskId,
    'userId': userId,
    'title': title,
    'completed': completed,
    'position': position,
  };
}

class SubtaskUpdateInput {
  final String? title;
  final bool? completed;
  final String? beforeId;
  final String? afterId;

  const SubtaskUpdateInput({
    this.title,
    this.completed,
    this.beforeId,
    this.afterId,
  });

  factory SubtaskUpdateInput.fromJson(Map<String, dynamic> json) => SubtaskUpdateInput(
    title: json['title'] as String?,
    completed: json['completed'] as bool?,
    beforeId: json['beforeId'] as String?,
    afterId: json['afterId'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'title': title,
    'completed': completed,
    'beforeId': beforeId,
    'afterId': afterId,
  };
}

class TaskCreateInput {
  final String title;
  final String? description;
  final TaskStatus? status;
  final TaskPriority? priority;
  final String? projectId;
  final DateTime? deadline;
  final List<String>? labelIds;

  const TaskCreateInput({
    required this.title,
    this.description,
    this.status,
    this.priority,
    this.projectId,
    this.deadline,
    this.labelIds,
  });

  factory TaskCreateInput.fromJson(Map<String, dynamic> json) => TaskCreateInput(
    title: json['title'] as String,
    description: json['description'] as String?,
    status: json['status'] == null ? null : TaskStatus.values.byName(json['status'] as String),
    priority: json['priority'] == null ? null : TaskPriority.values.byName(json['priority'] as String),
    projectId: json['projectId'] as String?,
    deadline: json['deadline'] == null ? null : DateTime.parse(json['deadline'] as String),
    labelIds: json['labelIds'] == null ? null : (json['labelIds'] as List<dynamic>).map((e) => e as String).toList(),
  );

  Map<String, dynamic> toJson() => {
    'title': title,
    'description': description,
    'status': status?.name,
    'priority': priority?.name,
    'projectId': projectId,
    'deadline': deadline?.toIso8601String(),
    'labelIds': labelIds?.map((e) => e).toList(),
  };
}

class TaskListResponse {
  final List<TaskResponse> items;
  final DateTime? nextCursor;

  const TaskListResponse({
    required this.items,
    this.nextCursor,
  });

  factory TaskListResponse.fromJson(Map<String, dynamic> json) => TaskListResponse(
    items: (json['items'] as List<dynamic>).map((e) => TaskResponse.fromJson(e as Map<String, dynamic>)).toList(),
    nextCursor: json['nextCursor'] == null ? null : DateTime.parse(json['nextCursor'] as String),
  );

  Map<String, dynamic> toJson() => {
    'items': items.map((e) => e.toJson()).toList(),
    'nextCursor': nextCursor?.toIso8601String(),
  };
}

enum TaskPriority { LOW, MEDIUM, HIGH, URGENT }

class TaskResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String? projectId;
  final String title;
  final String? description;
  final TaskStatus status;
  final TaskPriority priority;
  final DateTime? deadline;
  final DateTime? completedAt;
  final double position;
  final List<String> labelIds;

  const TaskResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    this.projectId,
    required this.title,
    this.description,
    required this.status,
    required this.priority,
    this.deadline,
    this.completedAt,
    required this.position,
    required this.labelIds,
  });

  factory TaskResponse.fromJson(Map<String, dynamic> json) => TaskResponse(
    id: json['id'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    deletedAt: json['deletedAt'] == null ? null : DateTime.parse(json['deletedAt'] as String),
    version: json['version'] as int,
    userId: json['userId'] as String,
    projectId: json['projectId'] as String?,
    title: json['title'] as String,
    description: json['description'] as String?,
    status: TaskStatus.values.byName(json['status'] as String),
    priority: TaskPriority.values.byName(json['priority'] as String),
    deadline: json['deadline'] == null ? null : DateTime.parse(json['deadline'] as String),
    completedAt: json['completedAt'] == null ? null : DateTime.parse(json['completedAt'] as String),
    position: (json['position'] as num).toDouble(),
    labelIds: (json['labelIds'] as List<dynamic>).map((e) => e as String).toList(),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'userId': userId,
    'projectId': projectId,
    'title': title,
    'description': description,
    'status': status.name,
    'priority': priority.name,
    'deadline': deadline?.toIso8601String(),
    'completedAt': completedAt?.toIso8601String(),
    'position': position,
    'labelIds': labelIds.map((e) => e).toList(),
  };
}

enum TaskStatus { TODO, IN_PROGRESS, DONE, CANCELLED }

class TaskUpdateInput {
  final String? title;
  final String? description;
  final TaskStatus? status;
  final TaskPriority? priority;
  final String? projectId;
  final DateTime? deadline;
  final List<String>? labelIds;
  final String? beforeId;
  final String? afterId;

  const TaskUpdateInput({
    this.title,
    this.description,
    this.status,
    this.priority,
    this.projectId,
    this.deadline,
    this.labelIds,
    this.beforeId,
    this.afterId,
  });

  factory TaskUpdateInput.fromJson(Map<String, dynamic> json) => TaskUpdateInput(
    title: json['title'] as String?,
    description: json['description'] as String?,
    status: json['status'] == null ? null : TaskStatus.values.byName(json['status'] as String),
    priority: json['priority'] == null ? null : TaskPriority.values.byName(json['priority'] as String),
    projectId: json['projectId'] as String?,
    deadline: json['deadline'] == null ? null : DateTime.parse(json['deadline'] as String),
    labelIds: json['labelIds'] == null ? null : (json['labelIds'] as List<dynamic>).map((e) => e as String).toList(),
    beforeId: json['beforeId'] as String?,
    afterId: json['afterId'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'title': title,
    'description': description,
    'status': status?.name,
    'priority': priority?.name,
    'projectId': projectId,
    'deadline': deadline?.toIso8601String(),
    'labelIds': labelIds?.map((e) => e).toList(),
    'beforeId': beforeId,
    'afterId': afterId,
  };
}
