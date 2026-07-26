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

  Future<CalendarEventResponse> updateEvent(String id, CalendarEventUpdateInput input) async {
    final data = await _api.patch('/api/v1/calendar/events/$id', body: input.toJson());
    return CalendarEventResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteEvent(String id) async {
    await _api.delete('/api/v1/calendar/events/$id');
  }

  Future<List<HolidayResponse>> holidays(int year) async {
    final data = await _api.get('/api/v1/calendar/holidays', query: {'year': year});
    return (data['holidays'] as List<dynamic>).cast<Map<String, dynamic>>().map(HolidayResponse.fromJson).toList();
  }
}
