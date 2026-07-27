import 'package:flutter/material.dart';

/// Ports apps/web/src/app/globals.css's --radius-* scale (base --radius:
/// 0.5rem = 8px) to Flutter BorderRadius. Cards use xl, chips/inputs use
/// lg, small day-grid cells use md.
abstract final class AppRadius {
  static const double sm = 4;
  static const double md = 6;
  static const double lg = 8;
  static const double xl = 12;
}

abstract final class AppShape {
  static const BorderRadius sm = BorderRadius.all(
    Radius.circular(AppRadius.sm),
  );
  static const BorderRadius md = BorderRadius.all(
    Radius.circular(AppRadius.md),
  );
  static const BorderRadius lg = BorderRadius.all(
    Radius.circular(AppRadius.lg),
  );
  static const BorderRadius xl = BorderRadius.all(
    Radius.circular(AppRadius.xl),
  );
}
