import 'package:flutter/material.dart';

import '../../theme/tokens/spacing.dart';

/// Standard screen body: optional pull-to-refresh, a max content width so
/// list rows don't stretch edge-to-edge on a tablet, and the one
/// `EdgeInsets.all(16)` list padding the audit found was already the app's
/// single most consistent value (13/13 screens) — codified here instead
/// of repeated as a literal at every call site.
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.body,
    this.onRefresh,
    this.floatingActionButton,
    this.padded = true,
  });

  final Widget body;
  final Future<void> Function()? onRefresh;
  final Widget? floatingActionButton;

  /// False for screens that manage their own padding per-section (rare —
  /// prefer true and let children opt out).
  final bool padded;

  @override
  Widget build(BuildContext context) {
    Widget content = Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: Spacing.maxContentWidth),
        child: padded
            ? Padding(padding: const EdgeInsets.all(Spacing.lg), child: body)
            : body,
      ),
    );

    if (onRefresh != null) {
      content = RefreshIndicator(onRefresh: onRefresh!, child: content);
    }

    return Scaffold(body: content, floatingActionButton: floatingActionButton);
  }
}
