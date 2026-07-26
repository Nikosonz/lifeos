import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../notifications/notifications_providers.dart';
import '../providers.dart';
import '../shared/format_money.dart';
import '../theme/module_colors.dart';

class _Destination {
  final String path;
  final String label;
  final IconData icon;
  final ModuleKey module;
  const _Destination(this.path, this.label, this.icon, this.module);
}

// Mirrors apps/web/src/app/[locale]/(app)/_components/nav.tsx's top-level
// entries (the sub-pages under Finance/Tasks live inside each module's own
// screen via tabs, not as separate drawer rows — a drawer this deep would
// defeat the point of a persistent nav).
const _destinations = [
  _Destination('/finance', 'مالی', Icons.account_balance_wallet_outlined, ModuleKey.finance),
  _Destination('/tasks', 'وظایف', Icons.checklist_outlined, ModuleKey.tasks),
  _Destination('/habits', 'عادت‌ها', Icons.local_fire_department_outlined, ModuleKey.habits),
  _Destination('/calendar', 'تقویم', Icons.calendar_month_outlined, ModuleKey.calendar),
  _Destination('/notifications', 'اعلان‌ها', Icons.notifications_outlined, ModuleKey.notifications),
  _Destination('/reports', 'گزارش‌ها', Icons.bar_chart_outlined, ModuleKey.reports),
];

String titleFor(String location) {
  for (final d in _destinations) {
    if (location.startsWith(d.path)) return d.label;
  }
  if (location.startsWith('/sessions')) return 'دستگاه‌های فعال';
  return 'مال تو';
}

/// Persistent shell (AppBar + NavigationDrawer) around every authenticated
/// route — the Dart analog of apps/web's AppShell + Nav. One Drawer for all
/// six modules (rather than a 6-item bottom nav, past Material's
/// recommended max of 5) plus device management + logout.
class AppShell extends ConsumerWidget {
  final Widget child;
  final String location;
  const AppShell({super.key, required this.child, required this.location});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watching this here (not just from the Notifications screen itself)
    // keeps the drawer's unread badge live for as long as the drawer
    // exists — a second legitimate reason for the autoDispose poller to
    // stay alive, same one-request-per-30s cost either way.
    final unreadCount = ref.watch(notificationsProvider).value?.unreadCount ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text(titleFor(location))),
      drawer: NavigationDrawer(
        selectedIndex: _selectedIndex(location),
        onDestinationSelected: (i) {
          Navigator.of(context).pop();
          context.go(_destinations[i].path);
        },
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(28, 16, 16, 10),
            child: Text('مال تو', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
          ),
          for (final d in _destinations)
            NavigationDrawerDestination(
              icon: (d.module == ModuleKey.notifications && unreadCount > 0)
                  ? Badge(label: Text(toPersianDigits('$unreadCount')), child: Icon(d.icon, color: moduleColor(d.module)))
                  : Icon(d.icon, color: moduleColor(d.module)),
              label: Text(d.label),
            ),
          const Divider(indent: 16, endIndent: 16),
          ListTile(
            leading: const Icon(Icons.devices_outlined),
            title: const Text('دستگاه‌های فعال'),
            onTap: () {
              Navigator.of(context).pop();
              context.push('/sessions');
            },
          ),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('خروج'),
            onTap: () {
              Navigator.of(context).pop();
              ref.read(authControllerProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: child,
    );
  }

  int? _selectedIndex(String location) {
    for (var i = 0; i < _destinations.length; i++) {
      if (location.startsWith(_destinations[i].path)) return i;
    }
    return null;
  }
}
