import '../api/api_client.dart';
import '../generated/generated.dart';

/// Thin client over /api/v1/telemetry/* — no business logic, exactly like
/// every other repository here (Rule 1). The server decides nothing about
/// what to keep; it just stores what a consenting client sends.
class TelemetryRepository {
  final ApiClient _api;
  TelemetryRepository(this._api);

  Future<int> sendCrashes(List<TelemetryCrashInput> crashes) async {
    if (crashes.isEmpty) return 0;
    final data = await _api.post(
      '/api/v1/telemetry/crashes',
      body: TelemetryCrashBatchInput(crashes: crashes).toJson(),
    );
    return TelemetryIngestResponse.fromJson(
      (data as Map).cast<String, dynamic>(),
    ).accepted;
  }

  Future<int> sendEvents(List<TelemetryEventInput> events) async {
    if (events.isEmpty) return 0;
    final data = await _api.post(
      '/api/v1/telemetry/events',
      body: TelemetryEventBatchInput(events: events).toJson(),
    );
    return TelemetryIngestResponse.fromJson(
      (data as Map).cast<String, dynamic>(),
    ).accepted;
  }
}
