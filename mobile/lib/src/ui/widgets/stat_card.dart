import 'package:flutter/material.dart';

import '../../theme/tokens/spacing.dart';
import '../../theme/tokens/typography.dart';

/// One card for every "label above a number" tile — replaces the audit's
/// two near-identical hand-rolled versions (dashboard's hero balance card:
/// 20px padding, 8px label-to-value gap, headlineMedium; reports' KPI
/// tiles: 16px padding, 6px gap, and a value Text with NO fontSize at all,
/// so it was barely bigger than its own 12px label).
class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.dense = false,
  });

  /// A full-width hero stat (e.g. dashboard's total balance) vs. a tile
  /// meant to sit inside a Row of Expanded siblings (reports' KPIs).
  const StatCard.dense({super.key, required this.label, required this.value})
    : dense = true;

  final String label;

  /// Usually a MoneyText — passed as a Widget so callers control color
  /// (income/expense) without this component needing to know about money.
  final Widget value;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(dense ? Spacing.lg : Spacing.xl),
        child: Column(
          crossAxisAlignment: dense
              ? CrossAxisAlignment.start
              : CrossAxisAlignment.center,
          children: [
            Text(
              label,
              style: textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: Spacing.sm),
            DefaultTextStyle.merge(
              style: dense
                  ? (textTheme.titleLarge ?? const TextStyle())
                  : AppTypography.displayMoney.copyWith(
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
