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
  final String? name;
  final DateTime createdAt;
  final String timezone;
  final CalendarPreference calendarPreference;

  const MeResponse({
    required this.id,
    this.phone,
    this.email,
    this.name,
    required this.createdAt,
    required this.timezone,
    required this.calendarPreference,
  });

  factory MeResponse.fromJson(Map<String, dynamic> json) => MeResponse(
    id: json['id'] as String,
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    name: json['name'] as String?,
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
    'name': name,
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

class SessionListResponse {
  final List<SessionSummaryResponse> sessions;

  const SessionListResponse({required this.sessions});

  factory SessionListResponse.fromJson(Map<String, dynamic> json) =>
      SessionListResponse(
        sessions: (json['sessions'] as List<dynamic>)
            .map(
              (e) => SessionSummaryResponse.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
      );

  Map<String, dynamic> toJson() => {
    'sessions': sessions.map((e) => e.toJson()).toList(),
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
  final String? name;
  final String? timezone;
  final CalendarPreference? calendarPreference;

  const UpdateProfileInput({this.name, this.timezone, this.calendarPreference});

  factory UpdateProfileInput.fromJson(Map<String, dynamic> json) =>
      UpdateProfileInput(
        name: json['name'] as String?,
        timezone: json['timezone'] as String?,
        calendarPreference: json['calendarPreference'] == null
            ? null
            : CalendarPreference.values.byName(
                json['calendarPreference'] as String,
              ),
      );

  Map<String, dynamic> toJson() => {
    'name': name,
    if (timezone != null) 'timezone': timezone,
    if (calendarPreference != null)
      'calendarPreference': calendarPreference?.name,
  };
}

class UserResponse {
  final String id;
  final String? phone;
  final String? email;
  final String? name;
  final DateTime createdAt;

  const UserResponse({
    required this.id,
    this.phone,
    this.email,
    this.name,
    required this.createdAt,
  });

  factory UserResponse.fromJson(Map<String, dynamic> json) => UserResponse(
    id: json['id'] as String,
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    name: json['name'] as String?,
    createdAt: DateTime.parse(json['createdAt'] as String),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'phone': phone,
    'email': email,
    'name': name,
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

class VerifyOtpResponseTokens {
  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;

  const VerifyOtpResponseTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
  });

  factory VerifyOtpResponseTokens.fromJson(Map<String, dynamic> json) =>
      VerifyOtpResponseTokens(
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

class VerifyOtpResponse {
  final UserResponse user;
  final VerifyOtpResponseTokens tokens;
  final bool isNewUser;

  const VerifyOtpResponse({
    required this.user,
    required this.tokens,
    required this.isNewUser,
  });

  factory VerifyOtpResponse.fromJson(Map<String, dynamic> json) =>
      VerifyOtpResponse(
        user: UserResponse.fromJson(json['user'] as Map<String, dynamic>),
        tokens: VerifyOtpResponseTokens.fromJson(
          json['tokens'] as Map<String, dynamic>,
        ),
        isNewUser: json['isNewUser'] as bool,
      );

  Map<String, dynamic> toJson() => {
    'user': user.toJson(),
    'tokens': tokens.toJson(),
    'isNewUser': isNewUser,
  };
}
