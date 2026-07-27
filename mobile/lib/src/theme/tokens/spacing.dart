/// 4dp-base spacing scale. Every EdgeInsets/SizedBox in the app should
/// reference one of these instead of a raw number — see the design-system
/// audit in the mobile skill for why (padding/gaps had drifted to a
/// different value per screen for the same visual relationship).
abstract final class Spacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// Material's minimum touch-target row height.
  static const double rowHeight = 56;

  /// Content stays readable on tablets instead of stretching edge to edge.
  static const double maxContentWidth = 560;
}
