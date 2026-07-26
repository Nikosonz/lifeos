// Cross-checks the mobile client's fixed-Tehran-offset Jalali conversion
// against the exact reference instant CLAUDE.md documents for the server's
// own conversion (packages/core/src/shared/jalali.ts): Nowruz 1403/1/1 is
// 2024-03-19T20:30:00.000Z. If this ever drifts, mobile and web would show
// different calendar dates for the same instant.
import 'package:flutter_test/flutter_test.dart';
import 'package:lifeos/src/shared/format_jalali.dart';

void main() {
  test('Nowruz 1403 matches the server reference instant', () {
    final nowruz = DateTime.parse('2024-03-19T20:30:00.000Z');
    final j = jalaliForInstant(nowruz);

    expect(j.year, 1403);
    expect(j.month, 1);
    expect(j.day, 1);
  });

  test('an instant just before Nowruz is still 1402/12', () {
    final beforeNowruz = DateTime.parse('2024-03-19T20:29:59.000Z');
    final j = jalaliForInstant(beforeNowruz);

    expect(j.year, 1402);
    expect(j.month, 12);
  });

  test('formatJalaliDate renders Persian digits for fa', () {
    final nowruz = DateTime.parse('2024-03-19T20:30:00.000Z');
    expect(formatJalaliDate(nowruz, fa: true), '۱ فروردین ۱۴۰۳');
    expect(formatJalaliDate(nowruz, fa: false), '1 فروردین 1403');
  });
}
