import 'package:flutter/material.dart';

/// One typography scale for the whole app. Retires the two systems the
/// design-system audit found (Theme.of(context).textTheme.* used for only
/// 4 roles, plus ad-hoc TextStyle(fontSize: 11/12/13/22) everywhere else).
/// Vazirmatn ships 4 static weights (400/500/600/700); every role below
/// maps to one of them, never an interpolated weight.
abstract final class AppTypography {
  /// Hero balance / the single largest number on a screen.
  static const TextStyle displayMoney = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    height: 1.1,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static TextTheme textTheme(TextTheme base) => base.copyWith(
    headlineSmall: base.headlineSmall?.copyWith(
      fontSize: 24,
      fontWeight: FontWeight.w600,
    ),
    titleLarge: base.titleLarge?.copyWith(
      fontSize: 20,
      fontWeight: FontWeight.w600,
    ),
    titleMedium: base.titleMedium?.copyWith(
      fontSize: 16,
      fontWeight: FontWeight.w600,
    ),
    bodyLarge: base.bodyLarge?.copyWith(
      fontSize: 16,
      fontWeight: FontWeight.w400,
    ),
    bodyMedium: base.bodyMedium?.copyWith(
      fontSize: 14,
      fontWeight: FontWeight.w400,
    ),
    labelLarge: base.labelLarge?.copyWith(
      fontSize: 14,
      fontWeight: FontWeight.w500,
    ),
    bodySmall: base.bodySmall?.copyWith(
      fontSize: 13,
      fontWeight: FontWeight.w400,
    ),
    labelSmall: base.labelSmall?.copyWith(
      fontSize: 11,
      fontWeight: FontWeight.w500,
    ),
  );

  /// Money/stat columns need digits that align vertically — apply to any
  /// TextStyle showing a number in a list/table context.
  static TextStyle tabular(TextStyle style) =>
      style.copyWith(fontFeatures: const [FontFeature.tabularFigures()]);
}
