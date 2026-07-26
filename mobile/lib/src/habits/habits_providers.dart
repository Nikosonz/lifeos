import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../generated/generated.dart';
import '../providers.dart';
import 'habits_repository.dart';

final habitsRepositoryProvider = Provider<HabitsRepository>(
  (ref) => HabitsRepository(ref.read(apiClientProvider)),
);

final habitsProvider = FutureProvider.autoDispose<List<HabitResponse>>(
  (ref) => ref.read(habitsRepositoryProvider).listHabits(),
);

typedef MonthArgs = (String habitId, int year, int month);

final checkInsProvider = FutureProvider.autoDispose.family<List<HabitCheckInResponse>, MonthArgs>(
  (ref, args) => ref.read(habitsRepositoryProvider).listCheckIns(args.$1, jalaliYear: args.$2, jalaliMonth: args.$3),
);
