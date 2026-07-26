// GENERATED CODE - DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:dart -w @lifeos/contracts
// Source of truth: packages/contracts/src/**/schemas.ts (Zod).
// ignore_for_file: constant_identifier_names
// (enum members are named to match the wire values exactly, e.g. TaskStatus.IN_PROGRESS,
// so .name round-trips through toJson/fromJson without a lookup table.)

class AuthTokensResponse {
  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;

  const AuthTokensResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
  });

  factory AuthTokensResponse.fromJson(Map<String, dynamic> json) =>
      AuthTokensResponse(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresAt: DateTime.parse(json['expiresAt'] as String),
      );

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'expiresAt': expiresAt.toIso8601String(),
  };
}

enum CalendarPreference { JALALI, GREGORIAN }

class MeResponse {
  final String id;
  final String? phone;
  final String? email;
  final DateTime createdAt;
  final String timezone;
  final CalendarPreference calendarPreference;

  const MeResponse({
    required this.id,
    this.phone,
    this.email,
    required this.createdAt,
    required this.timezone,
    required this.calendarPreference,
  });

  factory MeResponse.fromJson(Map<String, dynamic> json) => MeResponse(
    id: json['id'] as String,
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    createdAt: DateTime.parse(json['createdAt'] as String),
    timezone: json['timezone'] as String,
    calendarPreference: CalendarPreference.values.byName(
      json['calendarPreference'] as String,
    ),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'phone': phone,
    'email': email,
    'createdAt': createdAt.toIso8601String(),
    'timezone': timezone,
    'calendarPreference': calendarPreference.name,
  };
}

class RefreshInput {
  final String refreshToken;

  const RefreshInput({required this.refreshToken});

  factory RefreshInput.fromJson(Map<String, dynamic> json) =>
      RefreshInput(refreshToken: json['refreshToken'] as String);

  Map<String, dynamic> toJson() => {'refreshToken': refreshToken};
}

class RequestOtpInput {
  final String? phone;
  final String? email;

  const RequestOtpInput({this.phone, this.email});

  factory RequestOtpInput.fromJson(Map<String, dynamic> json) =>
      RequestOtpInput(
        phone: json['phone'] as String?,
        email: json['email'] as String?,
      );

  Map<String, dynamic> toJson() => {
    if (phone != null) 'phone': phone,
    if (email != null) 'email': email,
  };
}

class SessionSummaryResponse {
  final String id;
  final String? userAgent;
  final String? ipAddress;
  final DateTime createdAt;
  final DateTime lastUsedAt;

  const SessionSummaryResponse({
    required this.id,
    this.userAgent,
    this.ipAddress,
    required this.createdAt,
    required this.lastUsedAt,
  });

  factory SessionSummaryResponse.fromJson(Map<String, dynamic> json) =>
      SessionSummaryResponse(
        id: json['id'] as String,
        userAgent: json['userAgent'] as String?,
        ipAddress: json['ipAddress'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        lastUsedAt: DateTime.parse(json['lastUsedAt'] as String),
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'userAgent': userAgent,
    'ipAddress': ipAddress,
    'createdAt': createdAt.toIso8601String(),
    'lastUsedAt': lastUsedAt.toIso8601String(),
  };
}

class UpdateProfileInput {
  final String? timezone;
  final CalendarPreference? calendarPreference;

  const UpdateProfileInput({this.timezone, this.calendarPreference});

  factory UpdateProfileInput.fromJson(Map<String, dynamic> json) =>
      UpdateProfileInput(
        timezone: json['timezone'] as String?,
        calendarPreference: json['calendarPreference'] == null
            ? null
            : CalendarPreference.values.byName(
                json['calendarPreference'] as String,
              ),
      );

  Map<String, dynamic> toJson() => {
    if (timezone != null) 'timezone': timezone,
    if (calendarPreference != null)
      'calendarPreference': calendarPreference?.name,
  };
}

class UserResponse {
  final String id;
  final String? phone;
  final String? email;
  final DateTime createdAt;

  const UserResponse({
    required this.id,
    this.phone,
    this.email,
    required this.createdAt,
  });

  factory UserResponse.fromJson(Map<String, dynamic> json) => UserResponse(
    id: json['id'] as String,
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    createdAt: DateTime.parse(json['createdAt'] as String),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'phone': phone,
    'email': email,
    'createdAt': createdAt.toIso8601String(),
  };
}

class VerifyOtpInput {
  final String? phone;
  final String? email;
  final String code;

  const VerifyOtpInput({this.phone, this.email, required this.code});

  factory VerifyOtpInput.fromJson(Map<String, dynamic> json) => VerifyOtpInput(
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    code: json['code'] as String,
  );

  Map<String, dynamic> toJson() => {
    if (phone != null) 'phone': phone,
    if (email != null) 'email': email,
    'code': code,
  };
}
