import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../notifications/notifications_providers.dart';
import '../providers.dart';
import '../shared/connectivity_provider.dart';
import '../shared/format_money.dart';
import '../theme/module_colors.dart';
import '../theme/semantic_colors.dart';
import '../theme/tokens/spacing.dart';
import '../ui/onboarding/onboarding_overlay.dart';
import '../ui/widgets/widgets.dart';
import 'module_help_content.dart';

class _Destination {
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final ModuleKey module;
  const _Destination(this.label, this.icon, this.selectedIcon, this.module);
}

// Five bottom-nav destinations, not six — Notifications moved to an AppBar
// bell (see ADR-0015): Material's own guidance caps a bottom nav at 5, and
// unlike the other five modules, Notifications is a read-side feed you
// glance at and dismiss, not a place you *work*, so the bell-with-badge
// convention (present on nearly every mobile OS/app) fits it better than a
// permanent tab slot. Sub-pages under Finance/Tasks stay inside each
// module's own screen via tabs, same as before.
const _destinations = [
  _Destination(
    'مالی',
    Icons.account_balance_wallet_outlined,
    Icons.account_balance_wallet,
    ModuleKey.finance,
  ),
  _Destination(
    'وظایف',
    Icons.checklist_outlined,
    Icons.checklist,
    ModuleKey.tasks,
  ),
  _Destination(
    'عادت‌ها',
    Icons.local_fire_department_outlined,
    Icons.local_fire_department,
    ModuleKey.habits,
  ),
  _Destination(
    'تقویم',
    Icons.calendar_month_outlined,
    Icons.calendar_month,
    ModuleKey.calendar,
  ),
  _Destination(
    'گزارش‌ها',
    Icons.bar_chart_outlined,
    Icons.bar_chart,
    ModuleKey.reports,
  ),
];

// Fixed identity across AppShell's lifetime (same pattern as router.dart's
// navigator keys) — OnboardingOverlay measures these to spotlight each
// widget, which only works if the keys survive every rebuild rather than
// being recreated inline in build().
final _navBarKey = GlobalKey(debugLabel: 'onboarding-nav-bar');
final _bellKey = GlobalKey(debugLabel: 'onboarding-bell');
final _helpButtonKey = GlobalKey(debugLabel: 'onboarding-help');
final _overflowKey = GlobalKey(debugLabel: 'onboarding-overflow');

final _tourSteps = [
  const OnboardingStep(
    title: 'به مال تو خوش آمدید 👋',
    body: 'بیایید در چند قدم کوتاه ببینیم از کجا شروع کنید.',
  ),
  OnboardingStep(
    targetKey: _navBarKey,
    title: 'منوی اصلی',
    body:
        'بین ماژول‌های مالی، وظایف، عادت‌ها، تقویم و گزارش‌ها از اینجا جابه‌جا شوید.',
  ),
  OnboardingStep(
    targetKey: _bellKey,
    title: 'اعلان‌ها',
    body:
        'اعلان‌های هر ماژول (مثل عبور از سقف بودجه) همیشه از همین‌جا در دسترس‌اند.',
  ),
  OnboardingStep(
    targetKey: _helpButtonKey,
    title: 'راهنمای هر صفحه',
    body:
        'هر بخش یک دکمه راهنما دارد که نحوه استفاده از همان بخش را توضیح می‌دهد.',
  ),
  OnboardingStep(
    targetKey: _overflowKey,
    title: 'دستگاه‌ها و خروج',
    body: 'مدیریت دستگاه‌های فعال و خروج از حساب، از همین منو.',
  ),
];

/// Persistent shell (AppBar + bottom NavigationBar) around the five module
/// branches — the Dart analog of apps/web's AppShell + Nav, now matching
/// the bottom-nav pattern FotMob and most single-purpose mobile apps use
/// for their primary sections instead of a drawer (see ADR-0015: a drawer
/// hides all six destinations behind a hamburger at rest; a bottom nav
/// keeps five of them one thumb-tap away, always visible).
class AppShell extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;
  const AppShell({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadCount =
        ref.watch(notificationsProvider).value?.unreadCount ?? 0;
    final current = _destinations[navigationShell.currentIndex];
    final help = helpContentFor(current.module);
    // AsyncLoading (no connectivity event has fired yet) intentionally
    // reads as "not offline" — the banner should never flash on before the
    // first real check resolves.
    final isOffline = ref.watch(isOfflineProvider).value ?? false;
    final themeMode = ref.watch(themeModeProvider);

    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: Text(current.label),
            actions: [
              PageHelpButton(
                key: _helpButtonKey,
                title: help.title,
                items: help.items,
              ),
              IconButton(
                key: _bellKey,
                tooltip: 'اعلان‌ها',
                icon: unreadCount > 0
                    ? Badge(
                        label: Text(toPersianDigits('$unreadCount')),
                        child: const Icon(Icons.notifications_outlined),
                      )
                    : const Icon(Icons.notifications_outlined),
                onPressed: () => context.push('/notifications'),
              ),
              PopupMenuButton<String>(
                key: _overflowKey,
                icon: const Icon(Icons.more_vert),
                onSelected: (value) {
                  switch (value) {
                    case 'theme_system':
                      ref
                          .read(themeModeProvider.notifier)
                          .setThemeMode(ThemeMode.system);
                    case 'theme_light':
                      ref
                          .read(themeModeProvider.notifier)
                          .setThemeMode(ThemeMode.light);
                    case 'theme_dark':
                      ref
                          .read(themeModeProvider.notifier)
                          .setThemeMode(ThemeMode.dark);
                    case 'tour':
                      ref.read(tourRestartSignalProvider.notifier).state++;
                    case 'sessions':
                      context.push('/sessions');
                    case 'logout':
                      ref.read(authControllerProvider.notifier).logout();
                  }
                },
                itemBuilder: (context) => [
                  CheckedPopupMenuItem(
                    value: 'theme_system',
                    checked: themeMode == ThemeMode.system,
                    child: const Text('پیش‌فرض سیستم'),
                  ),
                  CheckedPopupMenuItem(
                    value: 'theme_light',
                    checked: themeMode == ThemeMode.light,
                    child: const Text('حالت روشن'),
                  ),
                  CheckedPopupMenuItem(
                    value: 'theme_dark',
                    checked: themeMode == ThemeMode.dark,
                    child: const Text('حالت تیره'),
                  ),
                  const PopupMenuDivider(),
                  const PopupMenuItem(
                    value: 'tour',
                    child: ListTile(
                      leading: Icon(Icons.replay_outlined),
                      title: Text('نمایش راهنما'),
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'sessions',
                    child: ListTile(
                      leading: Icon(Icons.devices_outlined),
                      title: Text('دستگاه‌های فعال'),
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'logout',
                    child: ListTile(
                      leading: Icon(Icons.logout),
                      title: Text('خروج'),
                    ),
                  ),
                ],
              ),
            ],
          ),
          body: Column(
            children: [
              if (isOffline) const _OfflineBanner(),
              Expanded(child: navigationShell),
            ],
          ),
          bottomNavigationBar: NavigationBar(
            key: _navBarKey,
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: (index) => navigationShell.goBranch(
              index,
              initialLocation: index == navigationShell.currentIndex,
            ),
            destinations: [
              for (final d in _destinations)
                NavigationDestination(
                  icon: Icon(d.icon),
                  selectedIcon: Icon(
                    d.selectedIcon,
                    color: context.moduleAccent(d.module),
                  ),
                  label: d.label,
                ),
            ],
          ),
        ),
        OnboardingOverlay(steps: _tourSteps),
      ],
    );
  }
}

/// Persistent, not dismissible — unlike a `SnackBar`, offline is a
/// standing condition, not a one-off event, and every module tab shares it
/// since it sits above [navigationShell] rather than inside one branch.
class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Material(
      color: colors.errorContainer,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: Spacing.lg,
            vertical: Spacing.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.cloud_off_outlined,
                size: 18,
                color: colors.onErrorContainer,
              ),
              const SizedBox(width: Spacing.sm),
              Text(
                'اتصال اینترنت برقرار نیست',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: colors.onErrorContainer),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
