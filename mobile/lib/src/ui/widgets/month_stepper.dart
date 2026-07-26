import 'package:flutter/material.dart';

import '../../shared/format_jalali.dart';
import '../../theme/tokens/spacing.dart';

/// (jalaliYear, jalaliMonth)
typedef JalaliYearMonth = (int, int);

/// Consolidates the 4 near-duplicate month-stepper Rows the audit found
/// (dashboard_tab, reports_home, budgets_tab, calendar_home) — each had
/// its own copy of the year-rollover math and a different padding value.
/// chevron_right = previous / chevron_left = next is intentional, not a
/// mistake: under RTL, Row children lay out right-to-left, so the
/// right-pointing chevron sits nearer the start of Persian reading order
/// (matches the web's own Jalali month navigation).
class MonthStepper extends StatelessWidget {
  const MonthStepper({
    super.key,
    required this.year,
    required this.month,
    required this.onChanged,
  });

  final int year;
  final int month;
  final ValueChanged<JalaliYearMonth> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Spacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_right),
            tooltip: 'ماه قبل',
            onPressed: () =>
                onChanged(month == 1 ? (year - 1, 12) : (year, month - 1)),
          ),
          Text(
            jalaliMonthLabel(year, month, fa: true),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          IconButton(
            icon: const Icon(Icons.chevron_left),
            tooltip: 'ماه بعد',
            onPressed: () =>
                onChanged(month == 12 ? (year + 1, 1) : (year, month + 1)),
          ),
        ],
      ),
    );
  }
}
