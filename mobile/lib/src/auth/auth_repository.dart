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
    await _api.post('/api/v1/auth/request-otp', body: {
      'phone': ?phone,
      'email': ?email,
    });
  }

  Future<MeResponse> verifyOtp({String? phone, String? email, required String code}) async {
    final data = await _api.post('/api/v1/auth/verify-otp', body: {
      'phone': ?phone,
      'email': ?email,
      'code': code,
    });
    final tokens = AuthTokensResponse.fromJson((data['tokens'] as Map).cast<String, dynamic>());
    await _tokens.setTokens(tokens.accessToken, tokens.refreshToken);
    return me();
  }

  Future<MeResponse> me() async {
    final data = await _api.get('/api/v1/me');
    return MeResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<List<SessionSummaryResponse>> listSessions() async {
    final data = await _api.get('/api/v1/auth/sessions');
    final sessions = (data['sessions'] as List<dynamic>).cast<Map<String, dynamic>>();
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
