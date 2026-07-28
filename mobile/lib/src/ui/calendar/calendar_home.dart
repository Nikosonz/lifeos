import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:shamsi_date/shamsi_date.dart';

import '../../calendar/calendar_providers.dart';
import '../../generated/generated.dart';
import '../../shared/format_jalali.dart';
import '../../tasks/task_labels.dart';
import '../../theme/module_colors.dart';
import '../../theme/semantic_colors.dart';
import '../../theme/tokens/spacing.dart';
import '../widgets/widgets.dart';
import 'event_form_dialog.dart';

final _monthProvider = StateProvider.autoDispose<MonthArgs>((ref) {
  final now = Jalali.now();
  return (now.year, now.month);
});

/// Agenda view — merges events/task deadlines/holidays (the discriminated
/// CalendarItemResponse union) into one chronological, day-grouped list,
/// the same composition CLAUDE.md documents for the web's Agenda page.
/// Only source:"event" rows are editable here; task deadlines are
/// read-only projections (editing a task's deadline happens in Tasks).
class CalendarHomeScreen extends ConsumerWidget {
  const CalendarHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (year, month) = ref.watch(_monthProvider);
    final agenda = ref.watch(agendaProvider((year, month)));

    return AppScaffold(
      onRefresh: () async => ref.invalidate(agendaProvider((year, month))),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showEventFormDialog(context, ref),
        child: const Icon(Icons.add),
      ),
      body: AsyncValueView(
        value: agenda,
        onRetry: () => ref.invalidate(agendaProvider((year, month))),
        skeleton: (context) => const SkeletonList(),
        isEmpty: (data) => data.items.isEmpty,
        empty: (context) => Column(
          children: [
            MonthStepper(
              year: year,
              month: month,
              onChanged: (ym) => ref.read(_monthProvider.notifier).state = ym,
            ),
            Expanded(
              child: EmptyState(
                icon: Icons.event_busy_outlined,
                module: ModuleKey.calendar,
                message: 'رویدادی برای این ماه یافت نشد.',
              ),
            ),
          ],
        ),
        data: (context, data) {
          final grouped = <String, List<CalendarItemResponse>>{};
          for (final item in data.items) {
            final key = jalaliDateKey(item.start);
            grouped.putIfAbsent(key, () => []).add(item);
          }
          return ListView(
            children: [
              MonthStepper(
                year: year,
                month: month,
                onChanged: (ym) => ref.read(_monthProvider.notifier).state = ym,
              ),
              for (final entry in grouped.entries) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
                  child: Text(
                    formatJalaliDate(entry.value.first.start, fa: true),
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                for (final item in entry.value)
                  _AgendaTile(item: item, ref: ref),
              ],
            ],
          );
        },
      ),
    );
  }
}

String jalaliDateKey(DateTime instant) {
  final j = jalaliForInstant(instant);
  return '${j.year}-${j.month}-${j.day}';
}

class _AgendaTile extends StatelessWidget {
  final CalendarItemResponse item;
  final WidgetRef ref;
  const _AgendaTile({required this.item, required this.ref});

  @override
  Widget build(BuildContext context) {
    // Type-pattern switches only promote a local variable's static type
    // within each arm, not a field access re-evaluated via `this.item` —
    // binding it to a local first is what makes `item.isRecurring` etc.
    // resolve to the narrowed variant type below.
    final item = this.item;
    return switch (item) {
      CalendarEventItemResponse() => ListTile(
        leading: const Icon(Icons.event_outlined),
        title: Text(item.title),
        subtitle: Text(
          item.allDay ? 'تمام روز' : _timeRange(item.start, item.end),
        ),
        trailing: item.isRecurring ? const Icon(Icons.repeat, size: 18) : null,
        onTap: () => showEventFormDialog(context, ref, eventId: item.eventId),
      ),
      CalendarTaskItemResponse() => ListTile(
        leading: const Icon(Icons.checklist_outlined),
        title: Text(item.title),
        subtitle: const Text('مهلت وظیفه'),
        trailing: Chip(
          label: Text(
            taskStatusLabel(item.status),
            style: Theme.of(context).textTheme.labelSmall,
          ),
          backgroundColor: taskStatusColor(
            context,
            item.status,
          ).withValues(alpha: 0.15),
          padding: EdgeInsets.zero,
          visualDensity: VisualDensity.compact,
        ),
      ),
      CalendarHolidayItemResponse() => ListTile(
        leading: Icon(
          Icons.celebration_outlined,
          color: context.moduleAccent(ModuleKey.calendar),
        ),
        title: Text(item.title),
        subtitle: const Text('تعطیل رسمی'),
      ),
    };
  }

  String _timeRange(DateTime start, DateTime end) {
    final s = start.toLocal();
    final e = end.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(s.hour)}:${two(s.minute)} – ${two(e.hour)}:${two(e.minute)}';
  }
}
