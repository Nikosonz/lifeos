import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../generated/generated.dart';
import '../providers.dart';

sealed class AuthState {
  const AuthState();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthLoggedOut extends AuthState {
  const AuthLoggedOut();
}

class AuthLoggedIn extends AuthState {
  final MeResponse user;
  const AuthLoggedIn(this.user);
}

/// Owns the app's auth state. On startup it tries to restore a session from the
/// token store; a 401 anywhere (via [AuthInterceptor]) flips it back to logged
/// out. All the actual API work lives in [AuthRepository].
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    _restore();
    return const AuthLoading();
  }

  Future<void> _restore() async {
    final tokens = ref.read(tokenStoreProvider);
    if (await tokens.getAccess() == null) {
      state = const AuthLoggedOut();
      return;
    }
    try {
      state = AuthLoggedIn(await ref.read(authRepositoryProvider).me());
      _onAuthenticated(TelemetryEventName.APP_OPENED);
    } catch (_) {
      state = const AuthLoggedOut();
    }
  }

  void onLoggedIn(MeResponse user, {bool isNewUser = false}) {
    state = AuthLoggedIn(user);
    _onAuthenticated(
      isNewUser
          ? TelemetryEventName.SIGNUP_COMPLETED
          : TelemetryEventName.LOGIN_COMPLETED,
    );
  }

  // The single point where "we now have a valid Bearer token" becomes true,
  // for both a restored session and a fresh login — which is exactly when
  // buffered crashes from a previous run can finally be sent, since the
  // ingest routes are authenticated. Fire-and-forget: telemetry must never
  // delay or fail the login it is reporting on.
  void _onAuthenticated(TelemetryEventName event) {
    final telemetry = ref.read(telemetryControllerProvider);
    unawaited(telemetry.flushBufferedCrashes());
    unawaited(telemetry.track(event));
  }

  void markLoggedOut() => state = const AuthLoggedOut();

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthLoggedOut();
  }
}
