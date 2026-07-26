import '../api/api_client.dart';
import '../generated/generated.dart';

class ReportsRepository {
  final ApiClient _api;
  ReportsRepository(this._api);

  Future<ReportsDashboardResponse> dashboard({int? jalaliYear, int? jalaliMonth}) async {
    final data = await _api.get('/api/v1/reports/dashboard', query: {
      'jalaliYear': ?jalaliYear,
      'jalaliMonth': ?jalaliMonth,
    });
    return ReportsDashboardResponse.fromJson((data as Map).cast<String, dynamic>());
  }
}
