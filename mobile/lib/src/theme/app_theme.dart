import 'package:flutter/material.dart';

import 'module_colors.dart';
import 'semantic_colors.dart';
import 'tokens/shape.dart';
import 'tokens/spacing.dart';
import 'tokens/typography.dart';

/// Ports the web's design tokens (apps/web/src/app/globals.css) to Material 3
/// ThemeData: brand lapis as the seed color, Vazirmatn everywhere (the app is
/// fa-first/RTL, matching the web's --font-sans fallback chain).
///
/// Full theme, not just a color scheme — the design-system audit found the
/// 19-line version left textTheme/cardTheme/listTileTheme/inputDecoration
/// Theme/chipTheme/dividerTheme all on Flutter's un-opinionated defaults,
/// which is the root cause of screens picking inconsistent padding/type
/// per component instance instead of inheriting one.
ThemeData buildAppTheme({required Brightness brightness}) {
  final scheme = ColorScheme.fromSeed(
    seedColor: brandLapis,
    brightness: brightness,
  );
  final isDark = brightness == Brightness.dark;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: 'Vazirmatn',
    scaffoldBackgroundColor: scheme.surface,
    textTheme: AppTypography.textTheme(
      ThemeData(brightness: brightness).textTheme,
    ),
    extensions: [isDark ? AppColors.dark : AppColors.light],

    appBarTheme: AppBarThemeData(
      backgroundColor: scheme.surface,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      scrolledUnderElevation: 1,
    ),

    navigationDrawerTheme: NavigationDrawerThemeData(
      backgroundColor: scheme.surface,
    ),

    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surface,
      elevation: 2,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
    ),

    cardTheme: CardThemeData(
      elevation: 0,
      color: scheme.surfaceContainerLow,
      shape: const RoundedRectangleBorder(borderRadius: AppShape.xl),
      margin: EdgeInsets.zero,
    ),

    listTileTheme: ListTileThemeData(
      contentPadding: const EdgeInsets.symmetric(
        horizontal: Spacing.lg,
        vertical: Spacing.xs,
      ),
      minVerticalPadding: Spacing.sm,
      shape: const RoundedRectangleBorder(borderRadius: AppShape.md),
    ),

    dividerTheme: DividerThemeData(
      color: scheme.outlineVariant,
      space: 1,
      thickness: 1,
    ),

    chipTheme: ChipThemeData(
      padding: const EdgeInsets.symmetric(
        horizontal: Spacing.sm,
        vertical: Spacing.xs,
      ),
      labelStyle: AppTypography.textTheme(
        ThemeData(brightness: brightness).textTheme,
      ).labelSmall,
      shape: const RoundedRectangleBorder(borderRadius: AppShape.lg),
      side: BorderSide.none,
    ),

    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: AppShape.lg),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: Spacing.lg,
        vertical: Spacing.md,
      ),
    ),

    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: AppShape.lg),
        minimumSize: const Size(0, Spacing.rowHeight - Spacing.md),
      ),
    ),

    dialogTheme: DialogThemeData(
      shape: RoundedRectangleBorder(borderRadius: AppShape.xl),
    ),
  );
}
