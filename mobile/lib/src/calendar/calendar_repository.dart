import '../api/api_client.dart';
import '../generated/generated.dart';

/// Thin client over /api/v1/calendar/* — the agenda endpoint is the primary
/// read path (events + task deadlines + holidays pre-merged/sorted
/// server-side, same composition the web's Agenda page consumes), mirroring
/// CLAUDE.md's documented Calendar UI approach.
class CalendarRepository {
  final ApiClient _api;
  CalendarRepository(this._api);

  Future<CalendarAgendaResponse> agenda({required int jalaliYear, required int jalaliMonth}) async {
    final data = await _api.get('/api/v1/calendar/agenda', query: {
      'jalaliYear': jalaliYear,
      'jalaliMonth': jalaliMonth,
    });
    return CalendarAgendaResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<CalendarEventResponse> getEvent(String id) async {
    final data = await _api.get('/api/v1/calendar/events/$id');
    return CalendarEventResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<CalendarEventResponse> createEvent(CalendarEventCreateInput input) async {
    final data = await _api.post('/api/v1/calendar/events', body: input.toJson());
    return CalendarEventResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  /// `expectedVersion` is the `version` of the copy the user was actually
  /// looking at — an optimistic-concurrency precondition (ADR-0020). The server
  /// compares it inside the write itself and returns 409 if another device got
  /// there first.
  ///
  /// Required here even though the wire contract makes it optional: the
  /// contract is permissive so already-installed builds, which cannot be
  /// force-updated, keep working. New code has no such excuse, and a required
  /// named argument is what stops a future screen from quietly falling back to
  /// last-write-wins. Passed separately rather than set on the generated input
  /// object so there is exactly one way to supply it.
  Future<CalendarEventResponse> updateEvent(String id, CalendarEventUpdateInput input, {required int expectedVersion}) async {
    final data = await _api.patch('/api/v1/calendar/events/$id', body: {...input.toJson(), 'expectedVersion': expectedVersion});
    return CalendarEventResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteEvent(String id, {required int expectedVersion}) async {
    await _api.delete('/api/v1/calendar/events/$id', body: {'expectedVersion': expectedVersion});
  }

  Future<List<HolidayResponse>> holidays(int year) async {
    final data = await _api.get('/api/v1/calendar/holidays', query: {'year': year});
    return (data['holidays'] as List<dynamic>).cast<Map<String, dynamic>>().map(HolidayResponse.fromJson).toList();
  }
}
