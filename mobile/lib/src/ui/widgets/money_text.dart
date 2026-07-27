import 'package:flutter/material.dart';

import '../../shared/format_money.dart';
import '../../theme/semantic_colors.dart';
import '../../theme/tokens/typography.dart';

enum MoneySign { neutral, signed }

/// One place every Rial-string amount becomes on-screen Toman text —
/// replaces the audit's per-screen copies of `formatTomanFromRial` +
/// hand-picked `Colors.green`/`Colors.red`/ternary color logic (dashboard,
/// wallets, reports, budgets all did this slightly differently). Always
/// tabular-figure digits so amounts align in a column.
class MoneyText extends StatelessWidget {
  const MoneyText(
    this.rial, {
    super.key,
    this.sign = MoneySign.neutral,
    this.isNegative,
    this.style,
    this.suffix = ' تومان',
  });

  final String rial;
  final MoneySign sign;

  /// Explicit direction override for magnitude+type fields (e.g. a
  /// transaction's non-negative `amount` plus a separate `type`) that have
  /// no '-' prefix of their own to infer from. Only meaningful when [sign]
  /// is MoneySign.signed; omit it for genuinely-signed fields (a wallet
  /// balance, a budget's remaining) where [rial] already carries its own
  /// sign.
  final bool? isNegative;
  final TextStyle? style;

  /// Pass '' to omit the unit (e.g. inside a dense list row where the
  /// column header already says "تومان").
  final String suffix;

  @override
  Widget build(BuildContext context) {
    final base = style ?? DefaultTextStyle.of(context).style;
    Color? color;
    if (sign == MoneySign.signed) {
      final negative = isNegative ?? rial.trim().startsWith('-');
      color = negative ? context.colors.expense : context.colors.income;
    }
    return Text(
      '${formatTomanFromRial(rial, fa: true)}$suffix',
      style: AppTypography.tabular(base).copyWith(color: color ?? base.color),
    );
  }
}
