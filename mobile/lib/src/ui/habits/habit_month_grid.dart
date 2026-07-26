import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:shamsi_date/shamsi_date.dart';

import '../../generated/generated.dart';
import '../../habits/habits_providers.dart';
import '../../shared/format_jalali.dart';
import '../../shared/format_money.dart';

/// shamsi_date's weekDay is Saturday=1..Friday=7; the API's `weekdays` field
/// uses JS Date.getDay() convention (Sunday=0..Saturday=6, per
/// CLAUDE.md/HabitResponse) — this converts between the two.
int _jsWeekdayOf(Jalali j) => (j.weekDay + 5) % 7;

final _gridMonthProvider = StateProvider.autoDispose.family<(int, int), String>((ref, habitId) {
  final now = Jalali.now();
  return (now.year, now.month);
});

class HabitMonthGrid extends ConsumerWidget {
  final HabitResponse habit;
  const HabitMonthGrid({super.key, required this.habit});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (year, month) = ref.watch(_gridMonthProvider(habit.id));
    final checkIns = ref.watch(checkInsProvider((habit.id, year, month)));
    final checkedDays = {for (final c in checkIns.value ?? const <HabitCheckInResponse>[]) c.jalaliDay};

    final firstOfMonth = Jalali(year, month, 1);
    final monthLength = firstOfMonth.monthLength;
    final leadingBlanks = _jsWeekdayOf(firstOfMonth) == 6 ? 0 : _jsWeekdayOf(firstOfMonth) + 1;
    // Saturday (js weekday 6) is the grid's first column, so its own
    // leading-blank count is 0; every other weekday counts how far past
    // Saturday it falls.

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              icon: const Icon(Icons.chevron_right),
              onPressed: () => ref.read(_gridMonthProvider(habit.id).notifier).state = month == 1 ? (year - 1, 12) : (year, month - 1),
            ),
            Text(jalaliMonthLabel(year, month, fa: true)),
            IconButton(
              icon: const Icon(Icons.chevron_left),
              onPressed: () => ref.read(_gridMonthProvider(habit.id).notifier).state = month == 12 ? (year + 1, 1) : (year, month + 1),
            ),
          ],
        ),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            for (var i = 0; i < leadingBlanks; i++) const SizedBox.shrink(),
            for (var day = 1; day <= monthLength; day++)
              _DayCell(
                habit: habit,
                year: year,
                month: month,
                day: day,
                checked: checkedDays.contains(day),
              ),
          ],
        ),
      ],
    );
  }
}

class _DayCell extends ConsumerWidget {
  final HabitResponse habit;
  final int year;
  final int month;
  final int day;
  final bool checked;
  const _DayCell({required this.habit, required this.year, required this.month, required this.day, required this.checked});

  bool get _scheduled => habit.frequency == HabitFrequency.DAILY || habit.weekdays.contains(_jsWeekdayOf(Jalali(year, month, day)));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.all(2),
      child: Material(
        color: !_scheduled
            ? Colors.transparent
            : checked
                ? Theme.of(context).colorScheme.primary
                : Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: !_scheduled
              ? null
              : () async {
                  final repo = ref.read(habitsRepositoryProvider);
                  if (checked) {
                    await repo.uncheck(habit.id, jalaliYear: year, jalaliMonth: month, jalaliDay: day);
                  } else {
                    await repo.checkIn(habit.id, jalaliYear: year, jalaliMonth: month, jalaliDay: day);
                  }
                  ref.invalidate(checkInsProvider((habit.id, year, month)));
                  ref.invalidate(habitsProvider);
                },
          child: Center(
            child: Text(
              toPersianDigits('$day'),
              style: TextStyle(
                color: !_scheduled
                    ? Theme.of(context).disabledColor
                    : checked
                        ? Theme.of(context).colorScheme.onPrimary
                        : null,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
