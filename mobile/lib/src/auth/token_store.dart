import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Abstracts where auth tokens live so the same app runs plugin-free on the
/// Windows dev build (InMemoryTokenStore) and securely on Android (a
/// flutter_secure_storage-backed impl, added with the Android build). Mirrors
/// the tiny 4-op surface of the web's token-store.ts.
abstract class TokenStore {
  Future<String?> getAccess();
  Future<String?> getRefresh();
  Future<void> setTokens(String access, String refresh);
  Future<void> clear();
}

/// Dev-only, non-persistent. Tokens are lost on restart — fine for exercising
/// the login → /me → refresh → logout flow on the Windows target. Do NOT ship
/// this; Android uses a secure, persistent implementation (Keystore).
class InMemoryTokenStore implements TokenStore {
  String? _access;
  String? _refresh;

  @override
  Future<String?> getAccess() async => _access;

  @override
  Future<String?> getRefresh() async => _refresh;

  @override
  Future<void> setTokens(String access, String refresh) async {
    _access = access;
    _refresh = refresh;
  }

  @override
  Future<void> clear() async {
    _access = null;
    _refresh = null;
  }
}

/// Android's real implementation — backed by EncryptedSharedPreferences
/// (AES, key held in the Android Keystore), the secure analog of the web's
/// localStorage token-store.ts. Persistent across restarts, unlike
/// [InMemoryTokenStore].
class SecureTokenStore implements TokenStore {
  static const _accessKey = 'lifeos.accessToken';
  static const _refreshKey = 'lifeos.refreshToken';

  // EncryptedSharedPreferences is now automatic (Jetpack Security's
  // encryptedSharedPreferences flag is deprecated as of v10 — the plugin
  // migrates existing data to its own cipher on first access with no
  // opt-in needed), so no AndroidOptions() are passed here.
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  @override
  Future<String?> getAccess() => _storage.read(key: _accessKey);

  @override
  Future<String?> getRefresh() => _storage.read(key: _refreshKey);

  @override
  Future<void> setTokens(String access, String refresh) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
