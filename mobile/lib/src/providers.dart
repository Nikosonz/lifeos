import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart'; // StateProvider — simple local UI state, not app data
import 'package:shared_preferences/shared_preferences.dart';

import 'api/api_client.dart';
import 'auth/auth_controller.dart';
import 'auth/auth_repository.dart';
import 'auth/token_store.dart';
import 'config/env.dart';

// No default implementation — main.dart awaits SharedPreferences.getInstance()
// before runApp() and overrides this, since the underlying platform channel
// call is async and can't happen inside a provider's own (sync) constructor.
// Throws if read before that override is in place, same pattern as any other
// startup-only dependency.
final sharedPreferencesProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError(
    'sharedPreferencesProvider must be overridden in main.dart',
  ),
);

const _tutorialSeenKey = 'lifeos:onboarding-tour-seen';

// Same key string apps/web/src/app/[locale]/(app)/_components/onboarding-
// tour.tsx uses for its localStorage flag — the two stores are physically
// separate (device SharedPreferences vs. browser localStorage), matching
// names purely for grep-ability across the repo, not shared state.
final tutorialSeenProvider = NotifierProvider<TutorialSeenController, bool>(
  TutorialSeenController.new,
);

class TutorialSeenController extends Notifier<bool> {
  @override
  bool build() =>
      ref.read(sharedPreferencesProvider).getBool(_tutorialSeenKey) ?? false;

  Future<void> markSeen() async {
    await ref.read(sharedPreferencesProvider).setBool(_tutorialSeenKey, true);
    state = true;
  }
}

// A plain counter, not a bool: OnboardingOverlay listens for this value
// *changing* (via ref.listen, not watch) to manually restart the tour from
// the overflow menu's "نمایش راهنما" item, independent of the persisted
// tutorialSeenProvider flag — the auto-show-on-first-login path and the
// manual-replay path both end at the same overlay, but only the former
// should ever touch the persisted flag.
final tourRestartSignalProvider = StateProvider<int>((ref) => 0);

// Android gets persistent, Keystore-backed storage; every other target
// (Windows/desktop dev builds, and Flutter's test harness which has no
// Platform.isAndroid-relevant plugin registration) keeps the plugin-free
// in-memory store — see token_store.dart's own doc comments for why.
final tokenStoreProvider = Provider<TokenStore>(
  (ref) => Platform.isAndroid ? SecureTokenStore() : InMemoryTokenStore(),
);

final apiClientProvider = Provider<ApiClient>((ref) {
  final tokens = ref.read(tokenStoreProvider);
  BaseOptions options() => BaseOptions(
    baseUrl: Env.apiBaseUrl,
    headers: {'content-type': 'application/json'},
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 20),
  );
  final plainDio = Dio(options());
  final dio = Dio(options());
  dio.interceptors.add(
    AuthInterceptor(
      plainDio,
      tokens,
      () => ref.read(authControllerProvider.notifier).markLoggedOut(),
    ),
  );
  return ApiClient(dio);
});

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) =>
      AuthRepository(ref.read(apiClientProvider), ref.read(tokenStoreProvider)),
);

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
