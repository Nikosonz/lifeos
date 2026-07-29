// GENERATED CODE - DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:dart -w @lifeos/contracts
// Source of truth: packages/contracts/src/**/schemas.ts (Zod).
// ignore_for_file: constant_identifier_names
// (enum members are named to match the wire values exactly, e.g. TaskStatus.IN_PROGRESS,
// so .name round-trips through toJson/fromJson without a lookup table.)

class TelemetryCrashBatchInput {
  final List<TelemetryCrashInput> crashes;

  const TelemetryCrashBatchInput({required this.crashes});

  factory TelemetryCrashBatchInput.fromJson(Map<String, dynamic> json) =>
      TelemetryCrashBatchInput(
        crashes: (json['crashes'] as List<dynamic>)
            .map((e) => TelemetryCrashInput.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
    'crashes': crashes.map((e) => e.toJson()).toList(),
  };
}

class TelemetryCrashInput {
  final TelemetryCrashKind kind;
  final String message;
  final String stackTrace;
  final String appVersion;
  final String platform;
  final String? osVersion;
  final String? deviceModel;
  final DateTime occurredAt;

  const TelemetryCrashInput({
    required this.kind,
    required this.message,
    required this.stackTrace,
    required this.appVersion,
    required this.platform,
    this.osVersion,
    this.deviceModel,
    required this.occurredAt,
  });

  factory TelemetryCrashInput.fromJson(Map<String, dynamic> json) =>
      TelemetryCrashInput(
        kind: TelemetryCrashKind.values.byName(json['kind'] as String),
        message: json['message'] as String,
        stackTrace: json['stackTrace'] as String,
        appVersion: json['appVersion'] as String,
        platform: json['platform'] as String,
        osVersion: json['osVersion'] as String?,
        deviceModel: json['deviceModel'] as String?,
        occurredAt: DateTime.parse(json['occurredAt'] as String),
      );

  Map<String, dynamic> toJson() => {
    'kind': kind.name,
    'message': message,
    'stackTrace': stackTrace,
    'appVersion': appVersion,
    'platform': platform,
    if (osVersion != null) 'osVersion': osVersion,
    if (deviceModel != null) 'deviceModel': deviceModel,
    'occurredAt': occurredAt.toIso8601String(),
  };
}

enum TelemetryCrashKind { FLUTTER_ERROR, UNCAUGHT_ASYNC }

class TelemetryEventBatchInput {
  final List<TelemetryEventInput> events;

  const TelemetryEventBatchInput({required this.events});

  factory TelemetryEventBatchInput.fromJson(Map<String, dynamic> json) =>
      TelemetryEventBatchInput(
        events: (json['events'] as List<dynamic>)
            .map((e) => TelemetryEventInput.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
    'events': events.map((e) => e.toJson()).toList(),
  };
}

class TelemetryEventInput {
  final TelemetryEventName name;
  final String appVersion;
  final String platform;
  final DateTime occurredAt;

  const TelemetryEventInput({
    required this.name,
    required this.appVersion,
    required this.platform,
    required this.occurredAt,
  });

  factory TelemetryEventInput.fromJson(Map<String, dynamic> json) =>
      TelemetryEventInput(
        name: TelemetryEventName.values.byName(json['name'] as String),
        appVersion: json['appVersion'] as String,
        platform: json['platform'] as String,
        occurredAt: DateTime.parse(json['occurredAt'] as String),
      );

  Map<String, dynamic> toJson() => {
    'name': name.name,
    'appVersion': appVersion,
    'platform': platform,
    'occurredAt': occurredAt.toIso8601String(),
  };
}

enum TelemetryEventName {
  APP_OPENED,
  SIGNUP_COMPLETED,
  LOGIN_COMPLETED,
  TRANSACTION_CREATED,
  BUDGET_CREATED,
  TASK_CREATED,
  HABIT_CHECKED_IN,
  CALENDAR_EVENT_CREATED,
  REPORT_VIEWED,
}

class TelemetryIngestResponse {
  final int accepted;

  const TelemetryIngestResponse({required this.accepted});

  factory TelemetryIngestResponse.fromJson(Map<String, dynamic> json) =>
      TelemetryIngestResponse(accepted: json['accepted'] as int);

  Map<String, dynamic> toJson() => {'accepted': accepted};
}
