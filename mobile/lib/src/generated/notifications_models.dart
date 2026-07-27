// GENERATED CODE - DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:dart -w @lifeos/contracts
// Source of truth: packages/contracts/src/**/schemas.ts (Zod).
// ignore_for_file: constant_identifier_names
// (enum members are named to match the wire values exactly, e.g. TaskStatus.IN_PROGRESS,
// so .name round-trips through toJson/fromJson without a lookup table.)

class MarkAllReadResponse {
  final int updatedCount;

  const MarkAllReadResponse({required this.updatedCount});

  factory MarkAllReadResponse.fromJson(Map<String, dynamic> json) =>
      MarkAllReadResponse(updatedCount: json['updatedCount'] as int);

  Map<String, dynamic> toJson() => {'updatedCount': updatedCount};
}

class NotificationListResponse {
  final List<NotificationResponse> items;
  final DateTime? nextCursor;
  final int unreadCount;

  const NotificationListResponse({
    required this.items,
    this.nextCursor,
    required this.unreadCount,
  });

  factory NotificationListResponse.fromJson(Map<String, dynamic> json) =>
      NotificationListResponse(
        items: (json['items'] as List<dynamic>)
            .map(
              (e) => NotificationResponse.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
        nextCursor: json['nextCursor'] == null
            ? null
            : DateTime.parse(json['nextCursor'] as String),
        unreadCount: json['unreadCount'] as int,
      );

  Map<String, dynamic> toJson() => {
    'items': items.map((e) => e.toJson()).toList(),
    'nextCursor': nextCursor?.toIso8601String(),
    'unreadCount': unreadCount,
  };
}

class NotificationResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String type;
  final String title;
  final String body;
  final dynamic data;
  final DateTime? readAt;

  const NotificationResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    required this.type,
    required this.title,
    required this.body,
    this.data,
    this.readAt,
  });

  factory NotificationResponse.fromJson(Map<String, dynamic> json) =>
      NotificationResponse(
        id: json['id'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
        version: json['version'] as int,
        userId: json['userId'] as String,
        type: json['type'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        data: json['data'],
        readAt: json['readAt'] == null
            ? null
            : DateTime.parse(json['readAt'] as String),
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'userId': userId,
    'type': type,
    'title': title,
    'body': body,
    'data': data,
    'readAt': readAt?.toIso8601String(),
  };
}
