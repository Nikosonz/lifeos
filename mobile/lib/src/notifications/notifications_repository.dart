import '../api/api_client.dart';
import '../generated/generated.dart';

class NotificationsRepository {
  final ApiClient _api;
  NotificationsRepository(this._api);

  /// Cursor stays a raw String (the wire's ISO datetime string), same
  /// convention as Finance/Tasks' pagination — never parsed to DateTime,
  /// since its only job is to be echoed back verbatim as the next request's
  /// `cursor` param.
  Future<({List<NotificationResponse> items, String? nextCursor, int unreadCount})> list({
    String? cursor,
    int limit = 20,
  }) async {
    final data = await _api.get('/api/v1/notifications', query: {
      'cursor': ?cursor,
      'limit': limit,
    });
    final items = (data['items'] as List<dynamic>).cast<Map<String, dynamic>>().map(NotificationResponse.fromJson).toList();
    return (items: items, nextCursor: data['nextCursor'] as String?, unreadCount: data['unreadCount'] as int);
  }

  Future<void> markRead(String id) async {
    await _api.post('/api/v1/notifications/$id/read');
  }

  Future<int> markAllRead() async {
    final data = await _api.post('/api/v1/notifications/read-all');
    return MarkAllReadResponse.fromJson((data as Map).cast<String, dynamic>()).updatedCount;
  }
}
