import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../providers.dart';
import '../../shared/format_jalali.dart';
import '../widgets/widgets.dart';

final _sessionsProvider =
    FutureProvider.autoDispose<List<SessionSummaryResponse>>(
      (ref) => ref.read(authRepositoryProvider).listSessions(),
    );

String _lastUsedLabel(DateTime instant) {
  final local = instant.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${formatJalaliDate(instant, fa: true)} ${two(local.hour)}:${two(local.minute)}';
}

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
      // Pushed as a standalone route (not a bottom-nav shell branch), so
      // it needs its own AppBar + the automatic back button GoRouter gives
      // a pushed route — AppScaffold has no appBar slot for this, same
      // reasoning as notifications_home.dart.
      appBar: AppBar(title: const Text('دستگاه‌های فعال')),
      body: AsyncValueView(
        value: sessions,
        onRetry: () => ref.invalidate(_sessionsProvider),
        skeleton: (context) => const SkeletonList(),
        isEmpty: (list) => list.isEmpty,
        empty: (context) => const EmptyState(
          icon: Icons.devices_outlined,
          message: 'هیچ دستگاه فعالی یافت نشد.',
        ),
        data: (context, list) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(_sessionsProvider),
          child: ListView.builder(
            itemCount: list.length,
            itemBuilder: (context, i) {
              final s = list[i];
              return AppListRow(
                leadingIcon: Icons.devices,
                title: Text(s.userAgent ?? 'دستگاه ناشناس'),
                subtitle: Text(
                  'IP: ${s.ipAddress ?? '—'}\n'
                  'آخرین استفاده: ${_lastUsedLabel(s.lastUsedAt)}',
                ),
                actions: [
                  RowAction(
                    label: 'خروج از این دستگاه',
                    icon: Icons.logout,
                    destructive: true,
                    onTap: () => _confirmRevoke(context, ref, s),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _confirmRevoke(
    BuildContext context,
    WidgetRef ref,
    SessionSummaryResponse s,
  ) async {
    final ok = await confirmDestructive(
      context,
      title: 'خروج از «${s.userAgent ?? 'دستگاه ناشناس'}»؟',
      confirmLabel: 'خروج',
    );
    if (ok) {
      await ref.read(authRepositoryProvider).revokeSession(s.id);
      ref.invalidate(_sessionsProvider);
    }
  }
}
