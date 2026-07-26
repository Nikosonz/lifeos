import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../generated/generated.dart';
import '../providers.dart';
import 'notifications_repository.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(ref.read(apiClientProvider)),
);

typedef NotificationPage = ({List<NotificationResponse> items, String? nextCursor, int unreadCount});

/// Cursor-paginated + periodically polled — mobile has no push notifications
/// yet (many Iranian devices lack Google Play Services, so FCM is
/// unreliable; see the mobile skill's push-notification ADR), so this is
/// the MVP's "poll now, real push later" strategy: refresh every 30s while
/// a listener is actually watching (autoDispose tears the timer down the
/// moment the Notifications screen isn't visible).
class NotificationsController extends AsyncNotifier<NotificationPage> {
  Timer? _timer;

  @override
  Future<NotificationPage> build() async {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => refresh());
    ref.onDispose(() => _timer?.cancel());
    final page = await ref.read(notificationsRepositoryProvider).list();
    return (items: page.items, nextCursor: page.nextCursor, unreadCount: page.unreadCount);
  }

  Future<void> refresh() async {
    final page = await ref.read(notificationsRepositoryProvider).list();
    state = AsyncData((items: page.items, nextCursor: page.nextCursor, unreadCount: page.unreadCount));
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.nextCursor == null) return;
    final page = await ref.read(notificationsRepositoryProvider).list(cursor: current.nextCursor);
    state = AsyncData((
      items: [...current.items, ...page.items],
      nextCursor: page.nextCursor,
      unreadCount: page.unreadCount,
    ));
  }

  Future<void> markRead(String id) async {
    await ref.read(notificationsRepositoryProvider).markRead(id);
    await refresh();
  }

  Future<void> markAllRead() async {
    await ref.read(notificationsRepositoryProvider).markAllRead();
    await refresh();
  }
}

final notificationsProvider = AsyncNotifierProvider.autoDispose<NotificationsController, NotificationPage>(
  NotificationsController.new,
);
