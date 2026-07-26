import 'package:flutter_test/flutter_test.dart';
import 'package:lifeos/src/shared/format_money.dart';

void main() {
  test('formatTomanFromRial divides by 10 and groups thousands', () {
    expect(formatTomanFromRial('1234500', fa: false), '123,450');
    expect(formatTomanFromRial('1234500', fa: true), '۱۲۳,۴۵۰');
  });

  test('formatTomanFromRial preserves the sign of a negative balance', () {
    expect(formatTomanFromRial('-25000', fa: false), '-2,500');
  });

  test('parseTomanInputToRial round-trips through tomanRawFromRial', () {
    final rial = parseTomanInputToRial('۱۲۳۴۵۰');
    expect(rial, '1234500');
    expect(tomanRawFromRial(rial), '123450');
  });
}
