import 'package:flutter/material.dart';

import '../generated/generated.dart';

// Persian labels mirroring apps/web/src/messages/fa.json's Tasks namespace
// (statusTodo/statusInProgress/... priorityLow/...).
String taskStatusLabel(TaskStatus s) => switch (s) {
  TaskStatus.TODO => 'انجام‌نشده',
  TaskStatus.IN_PROGRESS => 'در حال انجام',
  TaskStatus.DONE => 'انجام‌شده',
  TaskStatus.CANCELLED => 'لغوشده',
};

Color taskStatusColor(TaskStatus s) => switch (s) {
  TaskStatus.TODO => Colors.grey,
  TaskStatus.IN_PROGRESS => Colors.blue,
  TaskStatus.DONE => Colors.green,
  TaskStatus.CANCELLED => Colors.red,
};

String taskPriorityLabel(TaskPriority p) => switch (p) {
  TaskPriority.LOW => 'کم',
  TaskPriority.MEDIUM => 'متوسط',
  TaskPriority.HIGH => 'زیاد',
  TaskPriority.URGENT => 'فوری',
};

Color taskPriorityColor(TaskPriority p) => switch (p) {
  TaskPriority.LOW => Colors.grey,
  TaskPriority.MEDIUM => Colors.blueGrey,
  TaskPriority.HIGH => Colors.orange,
  TaskPriority.URGENT => Colors.red,
};
