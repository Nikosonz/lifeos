import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'error_state.dart';

/// Collapses the audit's most-repeated pattern (13 near-identical
/// `provider.when(loading: ..., error: ..., data: ...)` blocks, each with
/// its own centered spinner and a raw-exception Text) into one call site.
/// [onRetry] should be `() => ref.invalidate(provider)` — the same
/// invalidate every RefreshIndicator on these screens already calls.
class AsyncValueView<T> extends StatelessWidget {
  const AsyncValueView({
    super.key,
    required this.value,
    required this.data,
    required this.onRetry,
    this.isEmpty,
    this.empty,
    this.skeleton,
  });

  final AsyncValue<T> value;
  final Widget Function(BuildContext context, T data) data;
  final VoidCallback onRetry;

  /// If provided and returns true for the loaded data, [empty] renders
  /// instead of [data] — e.g. `isEmpty: (list) => list.isEmpty`.
  final bool Function(T data)? isEmpty;
  final WidgetBuilder? empty;

  /// Optional list-shaped loading placeholder (e.g. `SkeletonList`) shown
  /// instead of the default centered spinner. Omitting it keeps today's
  /// behavior — no existing call site breaks.
  final WidgetBuilder? skeleton;

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: () =>
          skeleton?.call(context) ??
          const Center(child: CircularProgressIndicator()),
      error: (error, _) => ErrorState(error: error, onRetry: onRetry),
      data: (d) {
        if (isEmpty != null && empty != null && isEmpty!(d)) {
          return empty!(context);
        }
        return data(context, d);
      },
    );
  }
}
