import 'package:flutter/material.dart';

import '../../theme/tokens/spacing.dart';
import '../../theme/tokens/typography.dart';

/// One card for every "label above a number" tile — replaces the audit's
/// two near-identical hand-rolled versions (dashboard's hero balance card:
/// 20px padding, 8px label-to-value gap, headlineMedium; reports' KPI
/// tiles: 16px padding, 6px gap, and a value Text with NO fontSize at all,
/// so it was barely bigger than its own 12px label).
///
/// Only the full-width hero-stat shape (dashboard's total balance) is
/// implemented so far — add a `.dense` variant (a tile meant to sit inside
/// a Row of Expanded siblings) once Reports actually migrates to this
/// widget, rather than shipping an untested second code path now.
class StatCard extends StatelessWidget {
  const StatCard({super.key, required this.label, required this.value});

  final String label;

  /// Usually a MoneyText — passed as a Widget so callers control color
  /// (income/expense) without this component needing to know about money.
  final Widget value;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Spacing.xl),
        child: Column(
          children: [
            Text(
              label,
              style: textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: Spacing.sm),
            DefaultTextStyle.merge(
              style: AppTypography.displayMoney.copyWith(
                color: textTheme.headlineMedium?.color,
              ),
              child: value,
            ),
          ],
        ),
      ),
    );
  }
}
