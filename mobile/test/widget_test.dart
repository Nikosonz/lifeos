// Smoke test: with no stored token the app settles to the login screen
// without any network call (InMemoryTokenStore returns null).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:lifeos/src/app.dart';
import 'package:lifeos/src/providers.dart';

void main() {
  testWidgets('shows the login screen when logged out', (
    WidgetTester tester,
  ) async {
    // themeModeProvider reads sharedPreferencesProvider from the app root
    // (theme applies to the login screen too, not just the authenticated
    // shell), so every LifeOsApp pump needs a real prefs instance now.
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: const LifeOsApp(),
      ),
    );
    // Let the async session-restore microtask flip AuthLoading -> AuthLoggedOut,
    // then let go_router's redirect (splash -> login) settle.
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();

    expect(find.text('ورود به مال تو'), findsOneWidget);
    expect(find.text('دریافت کد'), findsOneWidget);
  });
}
