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
    } catch (_) {
      state = const AuthLoggedOut();
    }
  }

  void onLoggedIn(MeResponse user) => state = AuthLoggedIn(user);

  void markLoggedOut() => state = const AuthLoggedOut();

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthLoggedOut();
  }
}
