import 'package:flutter/animation.dart';

/// Motion confirms state changes, it never announces them — fast durations,
/// no bounce. Every AnimatedX/AnimationController in the app should use one
/// of these instead of a bespoke Duration/Curve pair.
abstract final class AppMotion {
  /// Checkbox toggles, chip selection.
  static const Duration instant = Duration(milliseconds: 100);
  static const Curve instantCurve = Curves.easeOut;

  /// Expand/collapse, tab indicator.
  static const Duration quick = Duration(milliseconds: 200);
  static const Curve quickCurve = Curves.easeOutCubic;

  /// Route transitions, tab switches.
  static const Duration standard = Duration(milliseconds: 300);
  static const Curve standardCurve = Curves.easeInOutCubicEmphasized;
}
