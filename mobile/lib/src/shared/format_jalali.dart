import 'package:shamsi_date/shamsi_date.dart';

import 'format_money.dart';

// Dart port of packages/core/src/shared/jalali.ts's TEHRAN_UTC_OFFSET_MINUTES
// discipline: Iran has used a single fixed UTC+03:30 offset with no
// daylight-saving since 2022, so shifting a UTC instant by this fixed
// amount before reading its wall-clock date is correct regardless of the
// device's own timezone — display-only, mirrors the server's own
// getJalaliDateForInstant (never recomputes a boundary the server owns).
const _tehranOffsetMinutes = 210;

const List<String> jalaliMonthNamesFa = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند', //
];

/// Converts a UTC instant to the Jalali calendar date it falls on,
/// Tehran-local — the display-only counterpart of the server's own
/// getJalaliDateForInstant.
Jalali jalaliForInstant(DateTime instant) {
  final shifted = instant.toUtc().add(const Duration(minutes: _tehranOffsetMinutes));
  return Jalali.fromDateTime(shifted);
}

String formatJalaliDate(DateTime instant, {required bool fa}) {
  final j = jalaliForInstant(instant);
  final name = jalaliMonthNamesFa[j.month - 1];
  final day = fa ? toPersianDigits('${j.day}') : '${j.day}';
  final year = fa ? toPersianDigits('${j.year}') : '${j.year}';
  return '$day $name $year';
}

String jalaliMonthLabel(int year, int month, {required bool fa}) {
  final name = jalaliMonthNamesFa[month - 1];
  final y = fa ? toPersianDigits('$year') : '$year';
  return '$name $y';
}
