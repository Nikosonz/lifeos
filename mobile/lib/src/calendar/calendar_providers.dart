import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../generated/generated.dart';
import '../providers.dart';
import 'calendar_repository.dart';

final calendarRepositoryProvider = Provider<CalendarRepository>(
  (ref) => CalendarRepository(ref.read(apiClientProvider)),
);

typedef MonthArgs = (int year, int month);

final agendaProvider = FutureProvider.autoDispose.family<CalendarAgendaResponse, MonthArgs>(
  (ref, args) => ref.read(calendarRepositoryProvider).agenda(jalaliYear: args.$1, jalaliMonth: args.$2),
);
