// ignore_for_file: avoid_print
//
// Standalone end-to-end check of the real Dart networking stack (ApiClient +
// AuthInterceptor + AuthRepository + token flow) against the running dev
// server. These files are pure Dart (dio only), so this runs via `dart run`
// with no Flutter test harness. Requires: dev server up + DEV_OTP_CODE=123456.
//
//   dart run tool/smoke_login.dart
//   dart run tool/smoke_login.dart --define=API_BASE_URL=http://localhost:3000

import 'package:dio/dio.dart';
import 'package:lifeos/src/api/api_client.dart';
import 'package:lifeos/src/auth/auth_repository.dart';
import 'package:lifeos/src/auth/token_store.dart';

Future<void> main() async {
  const base = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
  final tokens = InMemoryTokenStore();
  BaseOptions opts() => BaseOptions(
    baseUrl: base,
    headers: {'content-type': 'application/json'},
  );
  final plainDio = Dio(opts());
  final dio = Dio(opts());
  dio.interceptors.add(
    AuthInterceptor(plainDio, tokens, () => print('[interceptor] forced logout')),
  );
  final repo = AuthRepository(ApiClient(dio), tokens);

  const phone = '+989350007766';
  print('base = $base');

  print('1) request-otp for $phone ...');
  await repo.requestOtp(phone: phone);
  print('   ok');

  print('2) verify-otp with 123456 ...');
  final user = await repo.verifyOtp(phone: phone, code: '123456');
  print('   logged in: id=${user.id} phone=${user.phone} '
      'tz=${user.timezone} cal=${user.calendarPreference}');
  print('   access token stored? ${(await tokens.getAccess()) != null}');

  print('3) GET /me again via the stored Bearer token ...');
  final me = await repo.me();
  print('   me.id=${me.id}');

  print('4) logout ...');
  await repo.logout();
  print('   tokens cleared? ${(await tokens.getAccess()) == null}');

  print('ALL GOOD');
}
