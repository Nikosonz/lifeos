import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth/auth_controller.dart';
import 'nav/app_shell.dart';
import 'providers.dart';
import 'ui/calendar/calendar_home.dart';
import 'ui/finance/finance_home.dart';
import 'ui/habits/habits_home.dart';
import 'ui/login_screen.dart';
import 'ui/notifications/notifications_home.dart';
import 'ui/reports/reports_home.dart';
import 'ui/sessions/sessions_screen.dart';
import 'ui/settings/settings_screen.dart';
import 'ui/splash_screen.dart';
import 'ui/tasks/tasks_home.dart';

/// Bridges AuthController's Riverpod state into a Listenable so GoRouter
/// re-evaluates `redirect` the moment login/logout happens, without
/// recreating the GoRouter itself (which would blow away the nav stack).
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Ref ref) {
    ref.listen(authControllerProvider, (_, _) => notifyListeners());
  }
}

// One navigator key per bottom-nav branch, as go_router's own
// StatefulShellRoute pattern requires — this is what lets each module keep
// its own scroll position/sub-tab selection when you switch away and back,
// instead of rebuilding from scratch like a plain GoRoute swap would.
final _financeNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'finance');
final _tasksNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'tasks');
final _habitsNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'habits');
final _calendarNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'calendar');
final _reportsNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'reports');

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefresh(ref);
  return GoRouter(
    refreshListenable: refresh,
    initialLocation: '/splash',
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;
      if (auth is AuthLoading) return loc == '/splash' ? null : '/splash';
      final loggedIn = auth is AuthLoggedIn;
      if (!loggedIn) return loc == '/login' ? null : '/login';
      return (loc == '/login' || loc == '/splash') ? '/finance' : null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: _financeNavigatorKey,
            routes: [
              GoRoute(
                path: '/finance',
                builder: (context, state) => const FinanceHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _tasksNavigatorKey,
            routes: [
              GoRoute(
                path: '/tasks',
                builder: (context, state) => const TasksHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _habitsNavigatorKey,
            routes: [
              GoRoute(
                path: '/habits',
                builder: (context, state) => const HabitsHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _calendarNavigatorKey,
            routes: [
              GoRoute(
                path: '/calendar',
                builder: (context, state) => const CalendarHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _reportsNavigatorKey,
            routes: [
              GoRoute(
                path: '/reports',
                builder: (context, state) => const ReportsHomeScreen(),
              ),
            ],
          ),
        ],
      ),
      // Not a bottom-nav branch (see ADR-0015) — a normal pushed route, so
      // it renders full-screen with its own AppBar/back button rather than
      // inheriting AppShell's bottom nav.
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsHomeScreen(),
      ),
      GoRoute(
        path: '/sessions',
        builder: (context, state) => const SessionsScreen(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
    ],
  );
});
