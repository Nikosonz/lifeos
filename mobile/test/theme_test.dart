import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lifeos/src/api/api_client.dart';
import 'package:lifeos/src/app.dart';
import 'package:lifeos/src/auth/auth_controller.dart';
import 'package:lifeos/src/auth/auth_repository.dart';
import 'package:lifeos/src/auth/token_store.dart';
import 'package:lifeos/src/generated/generated.dart';
import 'package:lifeos/src/notifications/notifications_providers.dart';
import 'package:lifeos/src/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Same fakes onboarding_test.dart uses — this test is about theme
// switching, not login or notification polling.
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

class _FakeNotificationsController extends NotificationsController {
  @override
  Future<NotificationPage> build() async =>
      (items: const <NotificationResponse>[], nextCursor: null, unreadCount: 0);
}

// The Settings screen fetches /me before it renders anything, so without
// this the theme control never mounts. Subclasses the real repository
// rather than reimplementing it — only me() is exercised here.
class _FakeAuthRepository extends AuthRepository {
  _FakeAuthRepository() : super(ApiClient(Dio()), InMemoryTokenStore());

  @override
  Future<MeResponse> me() async => MeResponse(
    id: 'user-1',
    createdAt: DateTime(2026, 1, 1),
    timezone: 'Asia/Tehran',
    calendarPreference: CalendarPreference.JALALI,
  );
}

Future<SharedPreferences> _prefs(Map<String, Object> initial) async {
  SharedPreferences.setMockInitialValues(initial);
  return SharedPreferences.getInstance();
}

Future<void> _pumpApp(WidgetTester tester, SharedPreferences prefs) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        authControllerProvider.overrideWith(_FakeAuthController.new),
        authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
        notificationsProvider.overrideWith(_FakeNotificationsController.new),
      ],
      child: const LifeOsApp(),
    ),
  );
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('defaults to ThemeMode.system when nothing is persisted', (
    tester,
  ) async {
    final prefs = await _prefs({'lifeos:onboarding-tour-seen': true});
    await _pumpApp(tester, prefs);

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.system);
  });

  testWidgets('restores a persisted dark theme mode on launch', (tester) async {
    final prefs = await _prefs({
      'lifeos:onboarding-tour-seen': true,
      'lifeos:theme-mode': 'dark',
    });
    await _pumpApp(tester, prefs);

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.dark);
    final context = tester.element(find.byType(Scaffold).first);
    expect(Theme.of(context).brightness, Brightness.dark);
  });

  testWidgets('the Settings screen switches theme mode and persists it', (
    tester,
  ) async {
    final prefs = await _prefs({'lifeos:onboarding-tour-seen': true});
    await _pumpApp(tester, prefs);

    // Phase 6 moved the theme control out of the overflow menu and into
    // the Settings screen, so this drives the real route rather than the
    // menu items it used to assert on.
    await tester.tap(find.byIcon(Icons.more_vert));
    await tester.pumpAndSettle();
    await tester.tap(find.text('تنظیمات'));
    await tester.pumpAndSettle();

    // The theme control sits below the profile + preferences sections, so
    // in a test-sized viewport its ListView element is not built yet and
    // find.text would return zero matches without scrolling to it first.
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();

    await tester.tap(find.text('تیره'));
    await tester.pumpAndSettle();

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.dark);
    expect(prefs.getString('lifeos:theme-mode'), 'dark');
  });
}
