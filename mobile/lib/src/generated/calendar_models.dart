// GENERATED CODE - DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:dart -w @lifeos/contracts
// Source of truth: packages/contracts/src/**/schemas.ts (Zod).
// ignore_for_file: constant_identifier_names
// (enum members are named to match the wire values exactly, e.g. TaskStatus.IN_PROGRESS,
// so .name round-trips through toJson/fromJson without a lookup table.)

import 'tasks_models.dart';

class CalendarAgendaResponse {
  final DateTime from;
  final DateTime to;
  final List<CalendarItemResponse> items;

  const CalendarAgendaResponse({
    required this.from,
    required this.to,
    required this.items,
  });

  factory CalendarAgendaResponse.fromJson(Map<String, dynamic> json) => CalendarAgendaResponse(
    from: DateTime.parse(json['from'] as String),
    to: DateTime.parse(json['to'] as String),
    items: (json['items'] as List<dynamic>).map((e) => CalendarItemResponse.fromJson(e as Map<String, dynamic>)).toList(),
  );

  Map<String, dynamic> toJson() => {
    'from': from.toIso8601String(),
    'to': to.toIso8601String(),
    'items': items.map((e) => e.toJson()).toList(),
  };
}

class CalendarEventCreateInput {
  final String title;
  final String? description;
  final DateTime startAt;
  final DateTime endAt;
  final bool? allDay;
  final CalendarRecurrenceFreq? recurrenceFreq;
  final int? recurrenceInterval;
  final int? recurrenceCount;
  final DateTime? recurrenceUntil;
  final List<int>? recurrenceByWeekday;

  const CalendarEventCreateInput({
    required this.title,
    this.description,
    required this.startAt,
    required this.endAt,
    this.allDay,
    this.recurrenceFreq,
    this.recurrenceInterval,
    this.recurrenceCount,
    this.recurrenceUntil,
    this.recurrenceByWeekday,
  });

  factory CalendarEventCreateInput.fromJson(Map<String, dynamic> json) => CalendarEventCreateInput(
    title: json['title'] as String,
    description: json['description'] as String?,
    startAt: DateTime.parse(json['startAt'] as String),
    endAt: DateTime.parse(json['endAt'] as String),
    allDay: json['allDay'] as bool?,
    recurrenceFreq: json['recurrenceFreq'] == null ? null : CalendarRecurrenceFreq.values.byName(json['recurrenceFreq'] as String),
    recurrenceInterval: json['recurrenceInterval'] as int?,
    recurrenceCount: json['recurrenceCount'] as int?,
    recurrenceUntil: json['recurrenceUntil'] == null ? null : DateTime.parse(json['recurrenceUntil'] as String),
    recurrenceByWeekday: json['recurrenceByWeekday'] == null ? null : (json['recurrenceByWeekday'] as List<dynamic>).map((e) => e as int).toList(),
  );

  Map<String, dynamic> toJson() => {
    'title': title,
    'description': description,
    'startAt': startAt.toIso8601String(),
    'endAt': endAt.toIso8601String(),
    'allDay': allDay,
    'recurrenceFreq': recurrenceFreq?.name,
    'recurrenceInterval': recurrenceInterval,
    'recurrenceCount': recurrenceCount,
    'recurrenceUntil': recurrenceUntil?.toIso8601String(),
    'recurrenceByWeekday': recurrenceByWeekday?.map((e) => e).toList(),
  };
}

class CalendarEventListResponse {
  final DateTime from;
  final DateTime to;
  final List<CalendarOccurrenceResponse> items;

  const CalendarEventListResponse({
    required this.from,
    required this.to,
    required this.items,
  });

  factory CalendarEventListResponse.fromJson(Map<String, dynamic> json) => CalendarEventListResponse(
    from: DateTime.parse(json['from'] as String),
    to: DateTime.parse(json['to'] as String),
    items: (json['items'] as List<dynamic>).map((e) => CalendarOccurrenceResponse.fromJson(e as Map<String, dynamic>)).toList(),
  );

  Map<String, dynamic> toJson() => {
    'from': from.toIso8601String(),
    'to': to.toIso8601String(),
    'items': items.map((e) => e.toJson()).toList(),
  };
}

class CalendarEventResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String title;
  final String? description;
  final DateTime startAt;
  final DateTime endAt;
  final bool allDay;
  final CalendarRecurrenceFreq? recurrenceFreq;
  final int recurrenceInterval;
  final int? recurrenceCount;
  final DateTime? recurrenceUntil;
  final List<int> recurrenceByWeekday;

  const CalendarEventResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    required this.title,
    this.description,
    required this.startAt,
    required this.endAt,
    required this.allDay,
    this.recurrenceFreq,
    required this.recurrenceInterval,
    this.recurrenceCount,
    this.recurrenceUntil,
    required this.recurrenceByWeekday,
  });

  factory CalendarEventResponse.fromJson(Map<String, dynamic> json) => CalendarEventResponse(
    id: json['id'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    deletedAt: json['deletedAt'] == null ? null : DateTime.parse(json['deletedAt'] as String),
    version: json['version'] as int,
    userId: json['userId'] as String,
    title: json['title'] as String,
    description: json['description'] as String?,
    startAt: DateTime.parse(json['startAt'] as String),
    endAt: DateTime.parse(json['endAt'] as String),
    allDay: json['allDay'] as bool,
    recurrenceFreq: json['recurrenceFreq'] == null ? null : CalendarRecurrenceFreq.values.byName(json['recurrenceFreq'] as String),
    recurrenceInterval: json['recurrenceInterval'] as int,
    recurrenceCount: json['recurrenceCount'] as int?,
    recurrenceUntil: json['recurrenceUntil'] == null ? null : DateTime.parse(json['recurrenceUntil'] as String),
    recurrenceByWeekday: (json['recurrenceByWeekday'] as List<dynamic>).map((e) => e as int).toList(),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'userId': userId,
    'title': title,
    'description': description,
    'startAt': startAt.toIso8601String(),
    'endAt': endAt.toIso8601String(),
    'allDay': allDay,
    'recurrenceFreq': recurrenceFreq?.name,
    'recurrenceInterval': recurrenceInterval,
    'recurrenceCount': recurrenceCount,
    'recurrenceUntil': recurrenceUntil?.toIso8601String(),
    'recurrenceByWeekday': recurrenceByWeekday.map((e) => e).toList(),
  };
}

class CalendarEventUpdateInput {
  final String? title;
  final String? description;
  final DateTime? startAt;
  final DateTime? endAt;
  final bool? allDay;
  final CalendarRecurrenceFreq? recurrenceFreq;
  final int? recurrenceInterval;
  final int? recurrenceCount;
  final DateTime? recurrenceUntil;
  final List<int>? recurrenceByWeekday;

  const CalendarEventUpdateInput({
    this.title,
    this.description,
    this.startAt,
    this.endAt,
    this.allDay,
    this.recurrenceFreq,
    this.recurrenceInterval,
    this.recurrenceCount,
    this.recurrenceUntil,
    this.recurrenceByWeekday,
  });

  factory CalendarEventUpdateInput.fromJson(Map<String, dynamic> json) => CalendarEventUpdateInput(
    title: json['title'] as String?,
    description: json['description'] as String?,
    startAt: json['startAt'] == null ? null : DateTime.parse(json['startAt'] as String),
    endAt: json['endAt'] == null ? null : DateTime.parse(json['endAt'] as String),
    allDay: json['allDay'] as bool?,
    recurrenceFreq: json['recurrenceFreq'] == null ? null : CalendarRecurrenceFreq.values.byName(json['recurrenceFreq'] as String),
    recurrenceInterval: json['recurrenceInterval'] as int?,
    recurrenceCount: json['recurrenceCount'] as int?,
    recurrenceUntil: json['recurrenceUntil'] == null ? null : DateTime.parse(json['recurrenceUntil'] as String),
    recurrenceByWeekday: json['recurrenceByWeekday'] == null ? null : (json['recurrenceByWeekday'] as List<dynamic>).map((e) => e as int).toList(),
  );

  Map<String, dynamic> toJson() => {
    'title': title,
    'description': description,
    'startAt': startAt?.toIso8601String(),
    'endAt': endAt?.toIso8601String(),
    'allDay': allDay,
    'recurrenceFreq': recurrenceFreq?.name,
    'recurrenceInterval': recurrenceInterval,
    'recurrenceCount': recurrenceCount,
    'recurrenceUntil': recurrenceUntil?.toIso8601String(),
    'recurrenceByWeekday': recurrenceByWeekday?.map((e) => e).toList(),
  };
}

sealed class CalendarItemResponse {
  const CalendarItemResponse();

  factory CalendarItemResponse.fromJson(Map<String, dynamic> json) {
    switch (json['source'] as String) {
      case 'event':
        return CalendarEventItemResponse.fromJson(json);
      case 'task':
        return CalendarTaskItemResponse.fromJson(json);
      case 'holiday':
        return CalendarHolidayItemResponse.fromJson(json);
      default:
        throw FormatException('Unknown CalendarItemResponse source: ${json['source']}');
    }
  }

  String get title;
  DateTime get start;
  DateTime get end;
  bool get allDay;

  Map<String, dynamic> toJson();
}

class CalendarEventItemResponse extends CalendarItemResponse {
  @override
  final String title;
  @override
  final DateTime start;
  @override
  final DateTime end;
  @override
  final bool allDay;
  final String eventId;
  final bool isRecurring;

  const CalendarEventItemResponse({
    required this.title,
    required this.start,
    required this.end,
    required this.allDay,
    required this.eventId,
    required this.isRecurring,
  }) : super();

  factory CalendarEventItemResponse.fromJson(Map<String, dynamic> json) => CalendarEventItemResponse(
    title: json['title'] as String,
    start: DateTime.parse(json['start'] as String),
    end: DateTime.parse(json['end'] as String),
    allDay: json['allDay'] as bool,
    eventId: json['eventId'] as String,
    isRecurring: json['isRecurring'] as bool,
  );

  @override
  Map<String, dynamic> toJson() => {
    'source': 'event',
    'title': title,
    'start': start.toIso8601String(),
    'end': end.toIso8601String(),
    'allDay': allDay,
    'eventId': eventId,
    'isRecurring': isRecurring,
  };
}

class CalendarTaskItemResponse extends CalendarItemResponse {
  @override
  final String title;
  @override
  final DateTime start;
  @override
  final DateTime end;
  @override
  final bool allDay;
  final String taskId;
  final TaskStatus status;
  final TaskPriority priority;

  const CalendarTaskItemResponse({
    required this.title,
    required this.start,
    required this.end,
    required this.allDay,
    required this.taskId,
    required this.status,
    required this.priority,
  }) : super();

  factory CalendarTaskItemResponse.fromJson(Map<String, dynamic> json) => CalendarTaskItemResponse(
    title: json['title'] as String,
    start: DateTime.parse(json['start'] as String),
    end: DateTime.parse(json['end'] as String),
    allDay: json['allDay'] as bool,
    taskId: json['taskId'] as String,
    status: TaskStatus.values.byName(json['status'] as String),
    priority: TaskPriority.values.byName(json['priority'] as String),
  );

  @override
  Map<String, dynamic> toJson() => {
    'source': 'task',
    'title': title,
    'start': start.toIso8601String(),
    'end': end.toIso8601String(),
    'allDay': allDay,
    'taskId': taskId,
    'status': status.name,
    'priority': priority.name,
  };
}

class CalendarHolidayItemResponse extends CalendarItemResponse {
  @override
  final String title;
  @override
  final DateTime start;
  @override
  final DateTime end;
  @override
  final bool allDay;
  final int jalaliYear;
  final int jalaliMonth;
  final int jalaliDay;

  const CalendarHolidayItemResponse({
    required this.title,
    required this.start,
    required this.end,
    required this.allDay,
    required this.jalaliYear,
    required this.jalaliMonth,
    required this.jalaliDay,
  }) : super();

  factory CalendarHolidayItemResponse.fromJson(Map<String, dynamic> json) => CalendarHolidayItemResponse(
    title: json['title'] as String,
    start: DateTime.parse(json['start'] as String),
    end: DateTime.parse(json['end'] as String),
    allDay: json['allDay'] as bool,
    jalaliYear: json['jalaliYear'] as int,
    jalaliMonth: json['jalaliMonth'] as int,
    jalaliDay: json['jalaliDay'] as int,
  );

  @override
  Map<String, dynamic> toJson() => {
    'source': 'holiday',
    'title': title,
    'start': start.toIso8601String(),
    'end': end.toIso8601String(),
    'allDay': allDay,
    'jalaliYear': jalaliYear,
    'jalaliMonth': jalaliMonth,
    'jalaliDay': jalaliDay,
  };
}

class CalendarOccurrenceResponse {
  final String eventId;
  final String title;
  final DateTime occurrenceStart;
  final DateTime occurrenceEnd;
  final bool allDay;
  final bool isRecurring;

  const CalendarOccurrenceResponse({
    required this.eventId,
    required this.title,
    required this.occurrenceStart,
    required this.occurrenceEnd,
    required this.allDay,
    required this.isRecurring,
  });

  factory CalendarOccurrenceResponse.fromJson(Map<String, dynamic> json) => CalendarOccurrenceResponse(
    eventId: json['eventId'] as String,
    title: json['title'] as String,
    occurrenceStart: DateTime.parse(json['occurrenceStart'] as String),
    occurrenceEnd: DateTime.parse(json['occurrenceEnd'] as String),
    allDay: json['allDay'] as bool,
    isRecurring: json['isRecurring'] as bool,
  );

  Map<String, dynamic> toJson() => {
    'eventId': eventId,
    'title': title,
    'occurrenceStart': occurrenceStart.toIso8601String(),
    'occurrenceEnd': occurrenceEnd.toIso8601String(),
    'allDay': allDay,
    'isRecurring': isRecurring,
  };
}

enum CalendarRecurrenceFreq { DAILY, WEEKLY, MONTHLY, YEARLY }

class HolidayListResponse {
  final int year;
  final List<HolidayResponse> holidays;

  const HolidayListResponse({
    required this.year,
    required this.holidays,
  });

  factory HolidayListResponse.fromJson(Map<String, dynamic> json) => HolidayListResponse(
    year: json['year'] as int,
    holidays: (json['holidays'] as List<dynamic>).map((e) => HolidayResponse.fromJson(e as Map<String, dynamic>)).toList(),
  );

  Map<String, dynamic> toJson() => {
    'year': year,
    'holidays': holidays.map((e) => e.toJson()).toList(),
  };
}

class HolidayResponse {
  final String name;
  final int jalaliYear;
  final int jalaliMonth;
  final int jalaliDay;
  final DateTime date;

  const HolidayResponse({
    required this.name,
    required this.jalaliYear,
    required this.jalaliMonth,
    required this.jalaliDay,
    required this.date,
  });

  factory HolidayResponse.fromJson(Map<String, dynamic> json) => HolidayResponse(
    name: json['name'] as String,
    jalaliYear: json['jalaliYear'] as int,
    jalaliMonth: json['jalaliMonth'] as int,
    jalaliDay: json['jalaliDay'] as int,
    date: DateTime.parse(json['date'] as String),
  );

  Map<String, dynamic> toJson() => {
    'name': name,
    'jalaliYear': jalaliYear,
    'jalaliMonth': jalaliMonth,
    'jalaliDay': jalaliDay,
    'date': date.toIso8601String(),
  };
}
