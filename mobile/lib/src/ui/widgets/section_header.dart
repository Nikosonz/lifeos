import 'package:flutter/material.dart';

import '../../theme/tokens/spacing.dart';

/// The "وظایف انجام‌شده" / "کیف پول‌ها" row above a list section — was
/// `textTheme.titleMedium` directly on a bare Text in 4+ screens with no
/// shared padding, so the gap above/below drifted per screen (audit:
/// dashboard used SizedBox(16) before every section, reports used a mix).
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: Spacing.lg, bottom: Spacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleMedium),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
