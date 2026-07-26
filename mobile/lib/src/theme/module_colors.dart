import 'package:flutter/material.dart';

/// Dart port of apps/web/src/lib/module-colors.ts — same six module keys,
/// same accent hues (converted from the web's OKLCH tokens in globals.css
/// to sRGB so Flutter's Color can use them directly). Single place a
/// module's color is decided; don't hardcode a hue anywhere else.
enum ModuleKey { finance, tasks, habits, calendar, notifications, reports }

const Map<ModuleKey, Color> _moduleColors = {
  ModuleKey.finance: Color(0xFF359658),
  ModuleKey.tasks: Color(0xFF026FD7),
  ModuleKey.calendar: Color(0xFF8254C4),
  ModuleKey.notifications: Color(0xFFE99B2A),
  ModuleKey.reports: Color(0xFF00848B),
  ModuleKey.habits: Color(0xFFE24947),
};

/// Persian-tile brand accents (landing/login), matching --brand-lapis /
/// --brand-turquoise in apps/web/src/app/globals.css.
const Color brandLapis = Color(0xFF1E4798);
const Color brandTurquoise = Color(0xFF39BAB4);

Color moduleColor(ModuleKey key) => _moduleColors[key]!;

/// A tinted "subtle" background for chips/active-nav-rows, derived the same
/// way the web's `bg-module-*-subtle` tokens read as a near-white tint of
/// the accent rather than a separately authored value.
Color moduleSubtle(ModuleKey key, {required Brightness brightness}) {
  final c = moduleColor(key);
  return brightness == Brightness.dark
      ? Color.alphaBlend(c.withValues(alpha: 0.22), Colors.black)
      : Color.alphaBlend(c.withValues(alpha: 0.12), Colors.white);
}
