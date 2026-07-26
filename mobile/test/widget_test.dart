// Smoke test: with no stored token the app settles to the login screen
// without any network call (InMemoryTokenStore returns null).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:lifeos/src/app.dart';

void main() {
  testWidgets('shows the login screen when logged out', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: LifeOsApp()));
    // Let the async session-restore microtask flip AuthLoading -> AuthLoggedOut,
    // then let go_router's redirect (splash -> login) settle.
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();

    expect(find.text('ورود به مال تو'), findsOneWidget);
    expect(find.text('دریافت کد'), findsOneWidget);
  });
}
