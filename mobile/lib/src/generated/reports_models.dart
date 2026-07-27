// GENERATED CODE - DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:dart -w @lifeos/contracts
// Source of truth: packages/contracts/src/**/schemas.ts (Zod).
// ignore_for_file: constant_identifier_names
// (enum members are named to match the wire values exactly, e.g. TaskStatus.IN_PROGRESS,
// so .name round-trips through toJson/fromJson without a lookup table.)

import 'finance_models.dart';

class ReportsDashboardResponseTasks {
  final int completed;
  final int created;

  const ReportsDashboardResponseTasks({
    required this.completed,
    required this.created,
  });

  factory ReportsDashboardResponseTasks.fromJson(Map<String, dynamic> json) =>
      ReportsDashboardResponseTasks(
        completed: json['completed'] as int,
        created: json['created'] as int,
      );

  Map<String, dynamic> toJson() => {'completed': completed, 'created': created};
}

class ReportsDashboardResponse {
  final int jalaliYear;
  final int jalaliMonth;
  final DashboardResponse finance;
  final ReportsDashboardResponseTasks tasks;

  const ReportsDashboardResponse({
    required this.jalaliYear,
    required this.jalaliMonth,
    required this.finance,
    required this.tasks,
  });

  factory ReportsDashboardResponse.fromJson(Map<String, dynamic> json) =>
      ReportsDashboardResponse(
        jalaliYear: json['jalaliYear'] as int,
        jalaliMonth: json['jalaliMonth'] as int,
        finance: DashboardResponse.fromJson(
          json['finance'] as Map<String, dynamic>,
        ),
        tasks: ReportsDashboardResponseTasks.fromJson(
          json['tasks'] as Map<String, dynamic>,
        ),
      );

  Map<String, dynamic> toJson() => {
    'jalaliYear': jalaliYear,
    'jalaliMonth': jalaliMonth,
    'finance': finance.toJson(),
    'tasks': tasks.toJson(),
  };
}
