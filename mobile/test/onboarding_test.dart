import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lifeos/src/app.dart';
import 'package:lifeos/src/auth/auth_controller.dart';
import 'package:lifeos/src/generated/generated.dart';
import 'package:lifeos/src/notifications/notifications_providers.dart';
import 'package:lifeos/src/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Skips real auth/network round-trips entirely — this test is about the
// tour's own show/don't-show logic, not login or notification polling.
class _FakeAuthController extends AuthController {
  @override
  AuthState build() => AuthLoggedIn(
    MeResponse(
      id: 'user-1',
      createdAt: DateTime(2026, 1, 1),
      timezone: 'Asia/Tehran',
      calendarPreference: CalendarPreference.JALALI,
    ),
  );
}

// AsyncNotifierProvider needs a real return value; a fixed empty page avoids
// both a real HTTP call and NotificationsController's own Timer.periodic
// (never started, since this overrides build() instead of calling super).
class _FakeNotificationsController extends NotificationsController {
  @override
  Future<NotificationPage> build() async =>
      (items: const <NotificationResponse>[], nextCursor: null, unreadCount: 0);
}

Future<SharedPreferences> _prefs(Map<String, Object> initial) async {
  SharedPreferences.setMockInitialValues(initial);
  return SharedPreferences.getInstance();
}

void main() {
  testWidgets('shows the tour on first login when unseen', (tester) async {
    final prefs = await _prefs({});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          authControllerProvider.overrideWith(_FakeAuthController.new),
          notificationsProvider.overrideWith(_FakeNotificationsController.new),
        ],
        child: const LifeOsApp(),
      ),
    );
    await tester.pump(const Duration(milliseconds: 50));
    // pumpAndSettle repeatedly pumps until no frames are pending, which
    // advances the fake clock well past the overlay's ~1.5s show-delay on
    // its own — no explicit extra pump needed to reach that point.
    await tester.pumpAndSettle();

    expect(find.text('به مال تو خوش آمدید 👋'), findsOneWidget);
  });

  testWidgets('does not show the tour once already seen', (tester) async {
    final prefs = await _prefs({'lifeos:onboarding-tour-seen': true});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          authControllerProvider.overrideWith(_FakeAuthController.new),
          notificationsProvider.overrideWith(_FakeNotificationsController.new),
        ],
        child: const LifeOsApp(),
      ),
    );
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pumpAndSettle();

    expect(find.text('به مال تو خوش آمدید 👋'), findsNothing);
  });

  testWidgets('replays the tour from the overflow menu once already seen', (
    tester,
  ) async {
    final prefs = await _prefs({'lifeos:onboarding-tour-seen': true});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          authControllerProvider.overrideWith(_FakeAuthController.new),
          notificationsProvider.overrideWith(_FakeNotificationsController.new),
        ],
        child: const LifeOsApp(),
      ),
    );
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pumpAndSettle();
    expect(find.text('به مال تو خوش آمدید 👋'), findsNothing);

    await tester.tap(find.byIcon(Icons.more_vert));
    await tester.pumpAndSettle();
    await tester.tap(find.text('نمایش راهنما'));
    await tester.pumpAndSettle();

    expect(find.text('به مال تو خوش آمدید 👋'), findsOneWidget);
  });
}
