import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../generated/generated.dart';
import '../providers.dart';
import 'reports_repository.dart';

final reportsRepositoryProvider = Provider<ReportsRepository>(
  (ref) => ReportsRepository(ref.read(apiClientProvider)),
);

typedef MonthArgs = (int? year, int? month);

final reportsDashboardProvider = FutureProvider.autoDispose.family<ReportsDashboardResponse, MonthArgs>(
  (ref, args) => ref.read(reportsRepositoryProvider).dashboard(jalaliYear: args.$1, jalaliMonth: args.$2),
);
