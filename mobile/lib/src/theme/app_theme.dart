import 'package:flutter/material.dart';

import 'module_colors.dart';

/// Ports the web's design tokens (apps/web/src/app/globals.css) to Material 3
/// ThemeData: brand lapis as the seed color, Vazirmatn everywhere (the app is
/// fa-first/RTL, matching the web's --font-sans fallback chain).
ThemeData buildAppTheme({required Brightness brightness}) {
  final scheme = ColorScheme.fromSeed(seedColor: brandLapis, brightness: brightness);
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: 'Vazirmatn',
    scaffoldBackgroundColor: scheme.surface,
    appBarTheme: AppBarTheme(backgroundColor: scheme.surface, foregroundColor: scheme.onSurface, elevation: 0),
    navigationDrawerTheme: NavigationDrawerThemeData(backgroundColor: scheme.surface),
  );
}
