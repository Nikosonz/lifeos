import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../habits/habits_providers.dart';
import '../../shared/format_money.dart';
import '../../theme/module_colors.dart';
import '../../theme/semantic_colors.dart';
import '../../theme/tokens/spacing.dart';
import '../widgets/widgets.dart';
import 'habit_form_dialog.dart';
import 'habit_month_grid.dart';

const _weekdayShort = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

class HabitsHomeScreen extends ConsumerWidget {
  const HabitsHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final habits = ref.watch(habitsProvider);
    return AppScaffold(
      onRefresh: () async => ref.invalidate(habitsProvider),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showHabitFormDialog(context, ref),
        child: const Icon(Icons.add),
      ),
      body: AsyncValueView(
        value: habits,
        onRetry: () => ref.invalidate(habitsProvider),
        isEmpty: (list) => list.isEmpty,
        empty: (context) => EmptyState(
          icon: Icons.local_fire_department_outlined,
          module: ModuleKey.habits,
          message: 'هنوز عادتی نساخته‌اید.',
          hint: 'با ثبت اولین عادت، زنجیره‌اش را از همین امروز شروع کنید.',
          actionLabel: 'ساخت عادت',
          onAction: () => showHabitFormDialog(context, ref),
        ),
        data: (context, list) => ListView.builder(
          itemCount: list.length,
          itemBuilder: (context, i) => _HabitCard(habit: list[i]),
        ),
      ),
    );
  }
}

class _HabitCard extends ConsumerStatefulWidget {
  final HabitResponse habit;
  const _HabitCard({required this.habit});

  @override
  ConsumerState<_HabitCard> createState() => _HabitCardState();
}

class _HabitCardState extends ConsumerState<_HabitCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final habit = widget.habit;
    return Card(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      child: Column(
        children: [
          AppListRow(
            leadingIcon: Icons.local_fire_department,
            module: ModuleKey.habits,
            title: Text(habit.name),
            subtitle: Text(
              habit.frequency == HabitFrequency.DAILY
                  ? 'روزانه'
                  : 'هفتگی · ${habit.weekdays.map((d) => _weekdayShort[d]).join(' ')}',
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  toPersianDigits('${habit.streak}'),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: context.moduleAccent(ModuleKey.habits),
                  ),
                ),
                const SizedBox(width: Spacing.xs),
                Checkbox(
                  value: habit.checkedToday,
                  onChanged: (v) async {
                    final repo = ref.read(habitsRepositoryProvider);
                    if (v == true) {
                      await repo.checkIn(habit.id);
                    } else {
                      await repo.uncheck(habit.id);
                    }
                    ref.invalidate(habitsProvider);
                  },
                ),
                IconButton(
                  icon: Icon(_expanded ? Icons.expand_less : Icons.expand_more),
                  tooltip: _expanded ? 'بستن تقویم ماه' : 'نمایش تقویم ماه',
                  onPressed: () => setState(() => _expanded = !_expanded),
                ),
              ],
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                Spacing.md,
                0,
                Spacing.md,
                Spacing.md,
              ),
              child: HabitMonthGrid(habit: habit),
            ),
        ],
      ),
    );
  }
}
