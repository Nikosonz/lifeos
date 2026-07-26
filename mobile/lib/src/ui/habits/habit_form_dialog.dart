import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../generated/generated.dart';
import '../../habits/habits_providers.dart';

const _weekdayLabels = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

Future<void> showHabitFormDialog(BuildContext context, WidgetRef ref) async {
  final nameController = TextEditingController();
  var frequency = HabitFrequency.DAILY;
  final weekdays = <int>{};

  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('عادت جدید'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(controller: nameController, autofocus: true, decoration: const InputDecoration(labelText: 'نام')),
              const SizedBox(height: 12),
              SegmentedButton<HabitFrequency>(
                segments: const [
                  ButtonSegment(value: HabitFrequency.DAILY, label: Text('روزانه')),
                  ButtonSegment(value: HabitFrequency.WEEKLY, label: Text('هفتگی')),
                ],
                selected: {frequency},
                onSelectionChanged: (s) => setState(() => frequency = s.first),
              ),
              if (frequency == HabitFrequency.WEEKLY) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  children: [
                    for (var i = 0; i < 7; i++)
                      FilterChip(
                        label: Text(_weekdayLabels[i]),
                        selected: weekdays.contains(i),
                        onSelected: (v) => setState(() => v ? weekdays.add(i) : weekdays.remove(i)),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
          FilledButton(
            onPressed: nameController.text.trim().isEmpty ? null : () => Navigator.pop(context, true),
            child: const Text('ایجاد'),
          ),
        ],
      ),
    ),
  );

  if (ok != true) return;
  final name = nameController.text.trim();
  if (name.isEmpty) return;
  if (frequency == HabitFrequency.WEEKLY && weekdays.isEmpty) return;

  await ref.read(habitsRepositoryProvider).createHabit(HabitCreateInput(
    name: name,
    frequency: frequency,
    weekdays: frequency == HabitFrequency.WEEKLY ? weekdays.toList() : null,
  ));
  ref.invalidate(habitsProvider);
}
