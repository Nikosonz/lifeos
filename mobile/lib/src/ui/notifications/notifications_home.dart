import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../notifications/notifications_providers.dart';
import '../../shared/format_jalali.dart';
import '../../shared/format_money.dart';
import '../../theme/module_colors.dart';
import '../widgets/widgets.dart';

class NotificationsHomeScreen extends ConsumerWidget {
  const NotificationsHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(notificationsProvider);
    return Scaffold(
      // Pushed as a standalone route (not a bottom-nav shell branch), so
      // unlike before it no longer inherits AppShell's AppBar — needs its
      // own title + the automatic back button GoRouter gives a pushed route.
      appBar: AppBar(title: const Text('اعلان‌ها')),
      body: AsyncValueView(
        value: page,
        onRetry: () => ref.invalidate(notificationsProvider),
        skeleton: (context) => const SkeletonList(),
        isEmpty: (data) => data.items.isEmpty,
        empty: (context) => const EmptyState(
          icon: Icons.notifications_none,
          module: ModuleKey.notifications,
          message: 'اعلانی وجود ندارد.',
        ),
        data: (context, data) => RefreshIndicator(
          onRefresh: () => ref.read(notificationsProvider.notifier).refresh(),
          child: NotificationListener<ScrollEndNotification>(
            onNotification: (n) {
              if (n.metrics.extentAfter < 200) {
                ref.read(notificationsProvider.notifier).loadMore();
              }
              return false;
            },
            child: ListView.separated(
              itemCount: data.items.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final n = data.items[i];
                final unread = n.readAt == null;
                return ListTile(
                  tileColor: unread
                      ? Theme.of(
                          context,
                        ).colorScheme.primary.withValues(alpha: 0.05)
                      : null,
                  leading: Icon(
                    unread ? Icons.circle : Icons.circle_outlined,
                    size: 10,
                    color: unread
                        ? Theme.of(context).colorScheme.primary
                        : Colors.transparent,
                  ),
                  title: Text(
                    n.title,
                    style: TextStyle(
                      fontWeight: unread ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  subtitle: Text(
                    '${n.body}\n${formatJalaliDate(n.createdAt, fa: true)}',
                  ),
                  isThreeLine: true,
                  onTap: unread
                      ? () => ref
                            .read(notificationsProvider.notifier)
                            .markRead(n.id)
                      : null,
                );
              },
            ),
          ),
        ),
      ),
      floatingActionButton: (page.value?.unreadCount ?? 0) > 0
          ? FloatingActionButton.extended(
              onPressed: () =>
                  ref.read(notificationsProvider.notifier).markAllRead(),
              icon: const Icon(Icons.done_all),
              label: Text(
                'علامت‌گذاری همه (${toPersianDigits('${page.value!.unreadCount}')})',
              ),
            )
          : null,
    );
  }
}
