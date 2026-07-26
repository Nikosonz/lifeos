// GENERATED CODE - DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:dart -w @lifeos/contracts
// Source of truth: packages/contracts/src/**/schemas.ts (Zod).
// ignore_for_file: constant_identifier_names
// (enum members are named to match the wire values exactly, e.g. TaskStatus.IN_PROGRESS,
// so .name round-trips through toJson/fromJson without a lookup table.)

class CheckInInput {
  final int? jalaliYear;
  final int? jalaliMonth;
  final int? jalaliDay;

  const CheckInInput({this.jalaliYear, this.jalaliMonth, this.jalaliDay});

  factory CheckInInput.fromJson(Map<String, dynamic> json) => CheckInInput(
    jalaliYear: json['jalaliYear'] as int?,
    jalaliMonth: json['jalaliMonth'] as int?,
    jalaliDay: json['jalaliDay'] as int?,
  );

  Map<String, dynamic> toJson() => {
    if (jalaliYear != null) 'jalaliYear': jalaliYear,
    if (jalaliMonth != null) 'jalaliMonth': jalaliMonth,
    if (jalaliDay != null) 'jalaliDay': jalaliDay,
  };
}

class CheckInListResponse {
  final List<HabitCheckInResponse> checkIns;

  const CheckInListResponse({required this.checkIns});

  factory CheckInListResponse.fromJson(Map<String, dynamic> json) =>
      CheckInListResponse(
        checkIns: (json['checkIns'] as List<dynamic>)
            .map(
              (e) => HabitCheckInResponse.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
      );

  Map<String, dynamic> toJson() => {
    'checkIns': checkIns.map((e) => e.toJson()).toList(),
  };
}

class HabitCheckInResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String habitId;
  final String userId;
  final int jalaliYear;
  final int jalaliMonth;
  final int jalaliDay;
  final DateTime checkedAt;

  const HabitCheckInResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.habitId,
    required this.userId,
    required this.jalaliYear,
    required this.jalaliMonth,
    required this.jalaliDay,
    required this.checkedAt,
  });

  factory HabitCheckInResponse.fromJson(Map<String, dynamic> json) =>
      HabitCheckInResponse(
        id: json['id'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
        version: json['version'] as int,
        habitId: json['habitId'] as String,
        userId: json['userId'] as String,
        jalaliYear: json['jalaliYear'] as int,
        jalaliMonth: json['jalaliMonth'] as int,
        jalaliDay: json['jalaliDay'] as int,
        checkedAt: DateTime.parse(json['checkedAt'] as String),
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'habitId': habitId,
    'userId': userId,
    'jalaliYear': jalaliYear,
    'jalaliMonth': jalaliMonth,
    'jalaliDay': jalaliDay,
    'checkedAt': checkedAt.toIso8601String(),
  };
}

class HabitCreateInput {
  final String name;
  final String? description;
  final String? color;
  final HabitFrequency frequency;
  final List<int>? weekdays;

  const HabitCreateInput({
    required this.name,
    this.description,
    this.color,
    required this.frequency,
    this.weekdays,
  });

  factory HabitCreateInput.fromJson(Map<String, dynamic> json) =>
      HabitCreateInput(
        name: json['name'] as String,
        description: json['description'] as String?,
        color: json['color'] as String?,
        frequency: HabitFrequency.values.byName(json['frequency'] as String),
        weekdays: json['weekdays'] == null
            ? null
            : (json['weekdays'] as List<dynamic>).map((e) => e as int).toList(),
      );

  Map<String, dynamic> toJson() => {
    'name': name,
    if (description != null) 'description': description,
    if (color != null) 'color': color,
    'frequency': frequency.name,
    if (weekdays != null) 'weekdays': weekdays?.map((e) => e).toList(),
  };
}

enum HabitFrequency { DAILY, WEEKLY }

class HabitListResponse {
  final List<HabitResponse> habits;

  const HabitListResponse({required this.habits});

  factory HabitListResponse.fromJson(Map<String, dynamic> json) =>
      HabitListResponse(
        habits: (json['habits'] as List<dynamic>)
            .map((e) => HabitResponse.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
    'habits': habits.map((e) => e.toJson()).toList(),
  };
}

class HabitResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String name;
  final String? description;
  final String? color;
  final HabitFrequency frequency;
  final List<int> weekdays;
  final int streak;
  final bool checkedToday;

  const HabitResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    required this.name,
    this.description,
    this.color,
    required this.frequency,
    required this.weekdays,
    required this.streak,
    required this.checkedToday,
  });

  factory HabitResponse.fromJson(Map<String, dynamic> json) => HabitResponse(
    id: json['id'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    deletedAt: json['deletedAt'] == null
        ? null
        : DateTime.parse(json['deletedAt'] as String),
    version: json['version'] as int,
    userId: json['userId'] as String,
    name: json['name'] as String,
    description: json['description'] as String?,
    color: json['color'] as String?,
    frequency: HabitFrequency.values.byName(json['frequency'] as String),
    weekdays: (json['weekdays'] as List<dynamic>).map((e) => e as int).toList(),
    streak: json['streak'] as int,
    checkedToday: json['checkedToday'] as bool,
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
    'frequency': frequency.name,
    'weekdays': weekdays.map((e) => e).toList(),
    'streak': streak,
    'checkedToday': checkedToday,
  };
}

class HabitUpdateInput {
  final String? name;
  final String? description;
  final String? color;
  final HabitFrequency? frequency;
  final List<int>? weekdays;

  const HabitUpdateInput({
    this.name,
    this.description,
    this.color,
    this.frequency,
    this.weekdays,
  });

  factory HabitUpdateInput.fromJson(Map<String, dynamic> json) =>
      HabitUpdateInput(
        name: json['name'] as String?,
        description: json['description'] as String?,
        color: json['color'] as String?,
        frequency: json['frequency'] == null
            ? null
            : HabitFrequency.values.byName(json['frequency'] as String),
        weekdays: json['weekdays'] == null
            ? null
            : (json['weekdays'] as List<dynamic>).map((e) => e as int).toList(),
      );

  Map<String, dynamic> toJson() => {
    if (name != null) 'name': name,
    'description': description,
    'color': color,
    if (frequency != null) 'frequency': frequency?.name,
    if (weekdays != null) 'weekdays': weekdays?.map((e) => e).toList(),
  };
}
