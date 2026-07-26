import 'package:dio/dio.dart';

import '../auth/token_store.dart';
import 'api_exception.dart';

/// The single choke point for every /api/v1 call — the Dart port of the web's
/// apiFetch (apps/web/src/lib/api-client.ts): decodes the JSON body, or turns
/// the API's error envelope into a typed [ApiException]. Auth (Bearer + 401
/// refresh rotation) is handled by [AuthInterceptor] on the underlying Dio.
class ApiClient {
  final Dio dio;
  ApiClient(this.dio);

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _send(() => dio.get(path, queryParameters: query));

  Future<dynamic> post(String path, {Object? body, String? idempotencyKey}) =>
      _send(() => dio.post(path, data: body ?? const {}, options: _opts(idempotencyKey)));

  Future<dynamic> patch(String path, {Object? body, String? idempotencyKey}) =>
      _send(() => dio.patch(path, data: body ?? const {}, options: _opts(idempotencyKey)));

  Future<dynamic> delete(String path, {Object? body}) =>
      _send(() => dio.delete(path, data: body));

  Options? _opts(String? idempotencyKey) => idempotencyKey == null
      ? null
      : Options(headers: {'idempotency-key': idempotencyKey});

  Future<dynamic> _send(Future<Response> Function() call) async {
    try {
      final res = await call();
      return res.data;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }
}

ApiException _toApiException(DioException e) {
  final data = e.response?.data;
  if (data is Map && data['error'] is Map) {
    final err = (data['error'] as Map).cast<String, dynamic>();
    return ApiException(
      err['code'] as String? ?? 'UNKNOWN',
      err['message'] as String? ?? 'Error',
      e.response?.statusCode ?? 0,
      data['requestId'] as String? ?? 'unknown',
      err['details'],
    );
  }
  return ApiException(
    'INTERNAL_ERROR',
    e.message ?? 'Unexpected error',
    e.response?.statusCode ?? 0,
    'unknown',
  );
}

/// Attaches the Bearer token and handles 401 refresh rotation — the behavioural
/// mirror of apiFetch's retry logic: concurrent 401s share ONE in-flight
/// refresh (the `??=` de-dup), then each retries its own request once with the
/// rotated token. A failed refresh clears tokens and signals logout.
class AuthInterceptor extends Interceptor {
  final Dio _plainDio; // no interceptor — used for the refresh call + the retry
  final TokenStore _tokens;
  final void Function() _onLogout;
  Future<bool>? _refreshing;

  AuthInterceptor(this._plainDio, this._tokens, this._onLogout);

  static const _refreshPath = '/api/v1/auth/refresh';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.path != _refreshPath) {
      final token = await _tokens.getAccess();
      if (token != null) options.headers['authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final status = err.response?.statusCode;
    final path = err.requestOptions.path;
    final isRetry = err.requestOptions.extra['__isRetry'] == true;

    if (status == 401 && !isRetry && path != _refreshPath) {
      _refreshing ??= _refresh();
      final ok = await _refreshing!.whenComplete(() => _refreshing = null);
      if (ok) {
        try {
          return handler.resolve(await _retry(err.requestOptions));
        } on DioException catch (e) {
          return handler.next(e);
        }
      }
      await _tokens.clear();
      _onLogout();
    }
    handler.next(err);
  }

  Future<Response<dynamic>> _retry(RequestOptions o) async {
    final token = await _tokens.getAccess();
    final headers = Map<String, dynamic>.from(o.headers);
    if (token != null) headers['authorization'] = 'Bearer $token';
    return _plainDio.request<dynamic>(
      o.path,
      data: o.data,
      queryParameters: o.queryParameters,
      options: Options(
        method: o.method,
        headers: headers,
        extra: {'__isRetry': true},
        contentType: o.contentType,
        responseType: o.responseType,
      ),
    );
  }

  Future<bool> _refresh() async {
    final refreshToken = await _tokens.getRefresh();
    if (refreshToken == null) return false;
    try {
      final res = await _plainDio.post(_refreshPath, data: {'refreshToken': refreshToken});
      final tokens = (res.data['tokens'] as Map).cast<String, dynamic>();
      await _tokens.setTokens(
        tokens['accessToken'] as String,
        tokens['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}
