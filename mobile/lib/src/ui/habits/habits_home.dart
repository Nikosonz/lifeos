import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../habits/habits_providers.dart';
import '../../shared/format_money.dart';
import 'habit_form_dialog.dart';
import 'habit_month_grid.dart';

const _weekdayShort = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

class HabitsHomeScreen extends ConsumerWidget {
  const HabitsHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final habits = ref.watch(habitsProvider);
    return Scaffold(
      body: habits.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطا: $e')),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('هنوز عادتی نساخته‌اید.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(habitsProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              itemBuilder: (context, i) => _HabitCard(habit: list[i]),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showHabitFormDialog(context, ref),
        child: const Icon(Icons.add),
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
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.local_fire_department, color: Colors.deepOrange),
            title: Text(habit.name),
            subtitle: Text(
              habit.frequency == HabitFrequency.DAILY
                  ? 'روزانه'
                  : 'هفتگی · ${habit.weekdays.map((d) => _weekdayShort[d]).join(' ')}',
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(toPersianDigits('${habit.streak}'), style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(width: 4),
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
                  onPressed: () => setState(() => _expanded = !_expanded),
                ),
              ],
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: HabitMonthGrid(habit: habit),
            ),
        ],
      ),
    );
  }
}
