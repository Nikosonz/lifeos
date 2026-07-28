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
  // Deepened from the web's literal oklch(0.75 0.15 70)->#E99B2A conversion
  // (kept invariant across brightness, same as every other module here) —
  // measured via WCAG contrast against ColorScheme.fromSeed's actual
  // light/dark surface colors while auditing Phase 4's dark-mode rollout:
  // the original amber cleared dark (8.1:1) but failed light (2.2:1),
  // under the 3:1 WCAG 1.4.11 non-text-contrast minimum for the icon-on-
  // surface/subtle-bg usage this renders as (EmptyState/AppListRow). This
  // tone clears 3:1 on both (4.4:1 light, 4.0:1 dark) without needing a
  // per-brightness split.
  ModuleKey.notifications: Color(0xFFA8641A),
  ModuleKey.reports: Color(0xFF00848B),
  ModuleKey.habits: Color(0xFFE24947),
};

/// Persian-tile brand accents (landing/login), matching --brand-lapis /
/// --brand-turquoise in apps/web/src/app/globals.css.
const Color brandLapis = Color(0xFF1E4798);
const Color brandTurquoise = Color(0xFF39BAB4);

Color moduleColor(ModuleKey key) => _moduleColors[key]!;

/// A tinted "subtle" background for chips/active-nav-rows/leading-icon
/// containers, derived the same way the web's `bg-module-*-subtle` tokens
/// read as a near-white tint of the accent rather than a separately
/// authored value. Shared by moduleSubtle() below and by semantic_colors
/// .dart's income/expense subtle getters — same blend, different source
/// color.
Color subtleTint(Color color, {required Brightness brightness}) {
  return brightness == Brightness.dark
      ? Color.alphaBlend(color.withValues(alpha: 0.22), Colors.black)
      : Color.alphaBlend(color.withValues(alpha: 0.12), Colors.white);
}

Color moduleSubtle(ModuleKey key, {required Brightness brightness}) =>
    subtleTint(moduleColor(key), brightness: brightness);
