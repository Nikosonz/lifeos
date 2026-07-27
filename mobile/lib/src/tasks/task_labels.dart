import 'package:flutter/material.dart';

import '../generated/generated.dart';
import '../theme/semantic_colors.dart';

// Persian labels mirroring apps/web/src/messages/fa.json's Tasks namespace
// (statusTodo/statusInProgress/... priorityLow/...).
String taskStatusLabel(TaskStatus s) => switch (s) {
  TaskStatus.TODO => 'انجام‌نشده',
  TaskStatus.IN_PROGRESS => 'در حال انجام',
  TaskStatus.DONE => 'انجام‌شده',
  TaskStatus.CANCELLED => 'لغوشده',
};

// Theme-aware, not raw Material constants (the design-system audit's "third
// parallel color system" — see docs/roadmap.md Phase 2) — mirrors the
// semantic weight of web's task-badges.tsx StatusBadge/PriorityBadge
// variants (default/secondary/outline/destructive) rather than inventing a
// new palette. Needs a BuildContext because DONE/CANCELLED reuse the app's
// existing income/expense semantics (context.colors), which are
// brightness-tuned ThemeExtension values, not plain consts.
Color taskStatusColor(BuildContext context, TaskStatus s) {
  final scheme = Theme.of(context).colorScheme;
  return switch (s) {
    TaskStatus.TODO => scheme.onSurfaceVariant,
    TaskStatus.IN_PROGRESS => scheme.primary,
    TaskStatus.DONE => context.colors.income,
    TaskStatus.CANCELLED => context.colors.expense,
  };
}

String taskPriorityLabel(TaskPriority p) => switch (p) {
  TaskPriority.LOW => 'کم',
  TaskPriority.MEDIUM => 'متوسط',
  TaskPriority.HIGH => 'زیاد',
  TaskPriority.URGENT => 'فوری',
};

// HIGH uses `tertiary`, not `primary` (web's own "default" variant), because
// mobile renders a task's status dot and priority chip side by side on one
// row — reusing `primary` here would recreate the exact same-color
// collision this migration fixes for CANCELLED/URGENT (both were literally
// Colors.red before), just shifted onto IN_PROGRESS/HIGH instead.
Color taskPriorityColor(BuildContext context, TaskPriority p) {
  final scheme = Theme.of(context).colorScheme;
  return switch (p) {
    TaskPriority.LOW => scheme.onSurfaceVariant,
    TaskPriority.MEDIUM => scheme.secondary,
    TaskPriority.HIGH => scheme.tertiary,
    TaskPriority.URGENT => scheme.error,
  };
}
