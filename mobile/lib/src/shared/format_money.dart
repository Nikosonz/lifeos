// Dart port of apps/web/src/lib/format-money.ts — same BigInt-only
// discipline (never parseDouble on a money string), same Toman = Rial ÷ 10
// display-scale conversion. See CLAUDE.md's Money & Date Conventions.
const _persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

String toPersianDigits(String input) {
  final buf = StringBuffer();
  for (final ch in input.split('')) {
    final d = int.tryParse(ch);
    buf.write(d == null ? ch : _persianDigits[d]);
  }
  return buf.toString();
}

String _groupDigits(BigInt absValue) {
  final s = absValue.toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return buf.toString();
}

/// [rial] is a MoneyAmountInput/SignedMoneyAmount-shaped string from the
/// API (optionally "-" prefixed for signed fields like a wallet balance).
String formatTomanFromRial(String rial, {required bool fa}) {
  final value = BigInt.parse(rial);
  final toman = value ~/ BigInt.from(10);
  final sign = toman.isNegative ? '-' : '';
  final grouped = '$sign${_groupDigits(toman.abs())}';
  return fa ? toPersianDigits(grouped) : grouped;
}

/// Un-grouped Toman digits for pre-filling an editable amount field, where
/// thousands separators would fight the cursor.
String tomanRawFromRial(String rial) => (BigInt.parse(rial) ~/ BigInt.from(10)).toString();

/// Reverse direction: a user-typed Toman amount (Persian or Latin digits)
/// becomes the Rial minor-unit string the API expects.
String parseTomanInputToRial(String input) {
  final latin = input.split('').map((ch) {
    final i = _persianDigits.indexOf(ch);
    return i == -1 ? ch : i.toString();
  }).join();
  final digitsOnly = latin.replaceAll(RegExp(r'[^0-9]'), '');
  if (digitsOnly.isEmpty) return '0';
  return (BigInt.parse(digitsOnly) * BigInt.from(10)).toString();
}
