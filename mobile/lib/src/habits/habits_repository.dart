import '../api/api_client.dart';
import '../generated/generated.dart';

/// Thin client over /api/v1/habits/* — streaks are always the server's
/// derived `streak`/`checkedToday` fields (Rule 1); this client never
/// walks check-in history itself, exactly like the web's HabitResponse
/// consumption.
class HabitsRepository {
  final ApiClient _api;
  HabitsRepository(this._api);

  Future<List<HabitResponse>> listHabits() async {
    final data = await _api.get('/api/v1/habits');
    return (data['habits'] as List<dynamic>).cast<Map<String, dynamic>>().map(HabitResponse.fromJson).toList();
  }

  Future<HabitResponse> createHabit(HabitCreateInput input) async {
    final data = await _api.post('/api/v1/habits', body: input.toJson());
    return HabitResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<HabitResponse> updateHabit(String id, HabitUpdateInput input) async {
    final data = await _api.patch('/api/v1/habits/$id', body: input.toJson());
    return HabitResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> deleteHabit(String id) async {
    await _api.delete('/api/v1/habits/$id');
  }

  Future<List<HabitCheckInResponse>> listCheckIns(String habitId, {required int jalaliYear, required int jalaliMonth}) async {
    final data = await _api.get('/api/v1/habits/$habitId/checkins', query: {
      'jalaliYear': jalaliYear,
      'jalaliMonth': jalaliMonth,
    });
    return (data['checkIns'] as List<dynamic>).cast<Map<String, dynamic>>().map(HabitCheckInResponse.fromJson).toList();
  }

  /// Omitting year/month/day defaults server-side to today (Tehran-local) —
  /// matching the web's "one-click check in today" convention exactly.
  Future<HabitCheckInResponse> checkIn(String habitId, {int? jalaliYear, int? jalaliMonth, int? jalaliDay}) async {
    final data = await _api.post(
      '/api/v1/habits/$habitId/checkins',
      body: CheckInInput(jalaliYear: jalaliYear, jalaliMonth: jalaliMonth, jalaliDay: jalaliDay).toJson(),
    );
    return HabitCheckInResponse.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> uncheck(String habitId, {int? jalaliYear, int? jalaliMonth, int? jalaliDay}) async {
    await _api.delete(
      '/api/v1/habits/$habitId/checkins',
      body: CheckInInput(jalaliYear: jalaliYear, jalaliMonth: jalaliMonth, jalaliDay: jalaliDay).toJson(),
    );
  }
}
