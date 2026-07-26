import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'auth/auth_controller.dart';
import 'auth/auth_repository.dart';
import 'auth/token_store.dart';
import 'config/env.dart';

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
  (ref) => AuthRepository(ref.read(apiClientProvider), ref.read(tokenStoreProvider)),
);

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
