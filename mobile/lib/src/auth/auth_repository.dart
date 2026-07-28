import '../api/api_client.dart';
import '../generated/generated.dart';
import 'token_store.dart';

/// Thin client over /api/v1/auth/* + /api/v1/me — no business logic, exactly
/// like every other LifeOS client (Rule 1). Same endpoints, same Bearer flow
/// the web/Telegram/MCP clients use.
class AuthRepository {
  final ApiClient _api;
  final TokenStore _tokens;
  AuthRepository(this._api, this._tokens);

  Future<void> requestOtp({String? phone, String? email}) async {
    await _api.post(
      '/api/v1/auth/request-otp',
      body: {'phone': ?phone, 'email': ?email},
    );
  }

  /// Returns `isNewUser` alongside the profile so the UI can show the
  /// name/consent step to genuinely new accounts only — the server is the
  /// one that knows (see ADR-0018); the client never infers it, e.g. from
  /// a null name, which a returning user who skipped the step also has.
  Future<({MeResponse user, bool isNewUser})> verifyOtp({
    String? phone,
    String? email,
    required String code,
  }) async {
    final data = await _api.post(
      '/api/v1/auth/verify-otp',
      body: {'phone': ?phone, 'email': ?email, 'code': code},
    );
    final tokens = AuthTokensResponse.fromJson(
      (data['tokens'] as Map).cast<String, dynamic>(),
    );
    await _tokens.setTokens(tokens.accessToken, tokens.refreshToken);
    // Still re-fetches /me rather than using the verify response's `user`:
    // that payload is a UserResponse, which lacks timezone/
    // calendarPreference, and the whole app is typed against MeResponse.
    return (user: await me(), isNewUser: data['isNewUser'] as bool? ?? false);
  }

  Future<MeResponse> me() async {
    final data = await _api.get('/api/v1/me');
    return MeResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  /// Takes the generated contract type rather than loose named params
  /// because its own `toJson` already encodes the distinction the server
  /// cares about: `name` is always sent (it is `.nullable().optional()`,
  /// so an explicit null legitimately means "clear it"), while timezone/
  /// calendarPreference are omitted when null ("leave unchanged").
  Future<MeResponse> updateProfile(UpdateProfileInput input) async {
    final data = await _api.patch('/api/v1/me', body: input.toJson());
    return MeResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<List<SessionSummaryResponse>> listSessions() async {
    final data = await _api.get('/api/v1/auth/sessions');
    final sessions = (data['sessions'] as List<dynamic>)
        .cast<Map<String, dynamic>>();
    return sessions.map(SessionSummaryResponse.fromJson).toList();
  }

  Future<void> revokeSession(String id) async {
    await _api.delete('/api/v1/auth/sessions/$id');
  }

  Future<void> logout() async {
    try {
      await _api.post('/api/v1/auth/logout');
    } catch (_) {
      // Best-effort server-side session revoke; always clear locally below.
    }
    await _tokens.clear();
  }
}
