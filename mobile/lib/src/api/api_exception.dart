/// Typed error surfaced from the API's standard error envelope
/// (`{ error: { code, message, details? }, requestId }`) — the Dart mirror of
/// the web client's `ApiError` in apps/web/src/lib/api-client.ts.
class ApiException implements Exception {
  final String code;
  final String message;
  final int status;
  final String requestId;
  final Object? details;

  ApiException(
    this.code,
    this.message,
    this.status,
    this.requestId, [
    this.details,
  ]);

  @override
  String toString() => 'ApiException($code, status=$status): $message';
}
