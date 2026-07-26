import 'package:flutter/material.dart';

import 'module_colors.dart';

/// Semantics the web already has (apps/web/src/app/globals.css's --income/
/// --expense) that never got ported to mobile — the design-system audit
/// found this is exactly why Colors.green/Colors.red/Colors.grey were
/// hardcoded 11+ times across screens instead of coming from one place.
/// A ThemeExtension (not plain consts) so brightness-aware values resolve
/// via `Theme.of(context).extension<AppColors>()` the same way ColorScheme
/// does, once dark-mode-specific tuning is needed.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.income,
    required this.expense,
    required this.neutralCaption,
  });

  final Color income;
  final Color expense;
  final Color neutralCaption;

  static const AppColors light = AppColors(
    income: Color(0xFF319751),
    expense: Color(0xFFD33A3C),
    neutralCaption: Color(0xFF5C5C5C),
  );

  static const AppColors dark = AppColors(
    income: Color(0xFF4FB876),
    expense: Color(0xFFE5696B),
    neutralCaption: Color(0xFFB8B8B8),
  );

  @override
  AppColors copyWith({Color? income, Color? expense, Color? neutralCaption}) =>
      AppColors(
        income: income ?? this.income,
        expense: expense ?? this.expense,
        neutralCaption: neutralCaption ?? this.neutralCaption,
      );

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      income: Color.lerp(income, other.income, t)!,
      expense: Color.lerp(expense, other.expense, t)!,
      neutralCaption: Color.lerp(neutralCaption, other.neutralCaption, t)!,
    );
  }
}

extension AppColorsContext on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;

  /// Subtle tint of income/expense — same blend module_colors.dart's
  /// moduleSubtle() uses, for AppListRow's leading-icon container when a
  /// row's meaningful color is income/expense rather than its module
  /// (Categories, Transactions).
  Color get incomeSubtle =>
      subtleTint(colors.income, brightness: Theme.of(this).brightness);
  Color get expenseSubtle =>
      subtleTint(colors.expense, brightness: Theme.of(this).brightness);
}

/// Module accent + its subtle tint, resolved for the current brightness —
/// thin wrapper over module_colors.dart so call sites don't need to thread
/// Brightness themselves.
extension ModuleColorsContext on BuildContext {
  Color moduleAccent(ModuleKey key) => moduleColor(key);
  Color moduleAccentSubtle(ModuleKey key) =>
      moduleSubtle(key, brightness: Theme.of(this).brightness);
}
