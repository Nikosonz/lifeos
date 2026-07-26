import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../calendar/calendar_providers.dart';
import '../../generated/generated.dart';
import '../../shared/format_jalali.dart';

const _weekdayLabels = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

/// Create (eventId == null) or edit. Unlike the web's dialog (which opens
/// instantly and fetches the full event underneath a loading ternary — a
/// bug CLAUDE.md documents, since remounting a Controller-bound Select
/// loses its freshly-reset value), this fetches BEFORE opening the dialog
/// at all, so the form only ever mounts once, fully pre-filled — sidesteps
/// that whole class of bug rather than reproducing the web's fix for it.
Future<void> showEventFormDialog(BuildContext context, WidgetRef ref, {String? eventId}) async {
  CalendarEventResponse? existing;
  if (eventId != null) {
    existing = await ref.read(calendarRepositoryProvider).getEvent(eventId);
  }
  if (!context.mounted) return;

  final titleController = TextEditingController(text: existing?.title ?? '');
  final descController = TextEditingController(text: existing?.description ?? '');
  var start = existing?.startAt ?? DateTime.now();
  var end = existing?.endAt ?? DateTime.now().add(const Duration(hours: 1));
  var allDay = existing?.allDay ?? false;
  CalendarRecurrenceFreq? recurrenceFreq = existing?.recurrenceFreq;
  final byWeekday = {...?existing?.recurrenceByWeekday};

  final saved = await showDialog<bool>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: Text(eventId == null ? 'رویداد جدید' : 'ویرایش رویداد'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(controller: titleController, autofocus: true, decoration: const InputDecoration(labelText: 'عنوان')),
              const SizedBox(height: 12),
              TextField(controller: descController, decoration: const InputDecoration(labelText: 'توضیحات (اختیاری)')),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('تمام روز'),
                value: allDay,
                onChanged: (v) => setState(() => allDay = v),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('شروع: ${formatJalaliDate(start, fa: true)}'),
                onTap: () async {
                  final picked = await showDatePicker(context: context, initialDate: start, firstDate: DateTime(2015), lastDate: DateTime(2100));
                  if (picked != null) setState(() => start = DateTime(picked.year, picked.month, picked.day, start.hour, start.minute));
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('پایان: ${formatJalaliDate(end, fa: true)}'),
                onTap: () async {
                  final picked = await showDatePicker(context: context, initialDate: end, firstDate: DateTime(2015), lastDate: DateTime(2100));
                  if (picked != null) setState(() => end = DateTime(picked.year, picked.month, picked.day, end.hour, end.minute));
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<CalendarRecurrenceFreq?>(
                initialValue: recurrenceFreq,
                decoration: const InputDecoration(labelText: 'تکرار'),
                items: const [
                  DropdownMenuItem(value: null, child: Text('بدون تکرار')),
                  DropdownMenuItem(value: CalendarRecurrenceFreq.DAILY, child: Text('روزانه')),
                  DropdownMenuItem(value: CalendarRecurrenceFreq.WEEKLY, child: Text('هفتگی')),
                  DropdownMenuItem(value: CalendarRecurrenceFreq.MONTHLY, child: Text('ماهانه')),
                  DropdownMenuItem(value: CalendarRecurrenceFreq.YEARLY, child: Text('سالانه')),
                ],
                onChanged: (v) => setState(() => recurrenceFreq = v),
              ),
              if (recurrenceFreq == CalendarRecurrenceFreq.WEEKLY) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  children: [
                    for (var i = 0; i < 7; i++)
                      FilterChip(
                        label: Text(_weekdayLabels[i]),
                        selected: byWeekday.contains(i),
                        onSelected: (v) => setState(() => v ? byWeekday.add(i) : byWeekday.remove(i)),
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
            onPressed: titleController.text.trim().isEmpty ? null : () => Navigator.pop(context, true),
            child: Text(eventId == null ? 'ایجاد' : 'ذخیره'),
          ),
        ],
      ),
    ),
  );

  if (saved != true) return;
  final title = titleController.text.trim();
  if (title.isEmpty) return;
  final description = descController.text.trim().isEmpty ? null : descController.text.trim();
  final repo = ref.read(calendarRepositoryProvider);

  if (eventId == null) {
    await repo.createEvent(CalendarEventCreateInput(
      title: title,
      description: description,
      startAt: start.toUtc(),
      endAt: end.toUtc(),
      allDay: allDay,
      recurrenceFreq: recurrenceFreq,
      recurrenceByWeekday: recurrenceFreq == CalendarRecurrenceFreq.WEEKLY ? byWeekday.toList() : null,
    ));
  } else {
    await repo.updateEvent(
      eventId,
      CalendarEventUpdateInput(
        title: title,
        description: description,
        startAt: start.toUtc(),
        endAt: end.toUtc(),
        allDay: allDay,
        recurrenceFreq: recurrenceFreq,
        recurrenceByWeekday: recurrenceFreq == CalendarRecurrenceFreq.WEEKLY ? byWeekday.toList() : null,
      ),
    );
  }
  ref.invalidate(agendaProvider);
}
