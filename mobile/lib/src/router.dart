import 'package:flutter/foundation.dart';
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
      GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      ShellRoute(
        builder: (context, state, child) => AppShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/finance', builder: (context, state) => const FinanceHomeScreen()),
          GoRoute(path: '/tasks', builder: (context, state) => const TasksHomeScreen()),
          GoRoute(path: '/habits', builder: (context, state) => const HabitsHomeScreen()),
          GoRoute(path: '/calendar', builder: (context, state) => const CalendarHomeScreen()),
          GoRoute(path: '/notifications', builder: (context, state) => const NotificationsHomeScreen()),
          GoRoute(path: '/reports', builder: (context, state) => const ReportsHomeScreen()),
          GoRoute(path: '/sessions', builder: (context, state) => const SessionsScreen()),
        ],
      ),
    ],
  );
});
