import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../providers.dart';

final _sessionsProvider = FutureProvider.autoDispose<List<SessionSummaryResponse>>(
  (ref) => ref.read(authRepositoryProvider).listSessions(),
);

/// Device/session management — GET+DELETE /api/v1/auth/sessions, the same
/// API the web's device-management screen uses. Lets a user see every
/// device currently logged in and revoke any one of them (including, in
/// principle, this one — a revoke of the active session surfaces on its
/// next request as a 401, handled the same way any other revocation is).
class SessionsScreen extends ConsumerWidget {
  const SessionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(_sessionsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('دستگاه‌های فعال')),
      body: sessions.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطا در دریافت دستگاه‌ها: $e')),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('هیچ دستگاه فعالی یافت نشد.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(_sessionsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final s = list[i];
                return ListTile(
                  leading: const Icon(Icons.devices),
                  title: Text(s.userAgent ?? 'دستگاه ناشناس'),
                  subtitle: Text(
                    'IP: ${s.ipAddress ?? '—'}\n'
                    'آخرین استفاده: ${s.lastUsedAt.toLocal()}',
                  ),
                  isThreeLine: true,
                  trailing: IconButton(
                    icon: const Icon(Icons.logout),
                    tooltip: 'خروج از این دستگاه',
                    onPressed: () async {
                      await ref.read(authRepositoryProvider).revokeSession(s.id);
                      ref.invalidate(_sessionsProvider);
                    },
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
