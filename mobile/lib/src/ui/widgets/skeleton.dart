import 'package:flutter/material.dart';

import '../../theme/tokens/shape.dart';
import '../../theme/tokens/spacing.dart';

/// A single shimmering placeholder block — a gradient sweep driven by an
/// [AnimationController], not a new package: the same zero-dependency
/// instinct the onboarding spotlight's `BoxShadow.spreadRadius` trick used
/// instead of a `CustomPainter`. Deliberately not one of [AppMotion]'s
/// durations — those are tuned for short state-confirmation transitions
/// (100-300ms), not a continuous ambient loop; 1200ms is the standard
/// shimmer cadence.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = AppShape.sm,
  });

  final double? width;
  final double height;
  final BorderRadius borderRadius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    final highlight = Theme.of(context).colorScheme.surfaceContainerHigh;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius,
            gradient: LinearGradient(
              begin: Alignment(-1 - t * 2, 0),
              end: Alignment(1 - t * 2, 0),
              colors: [base, highlight, base],
              stops: const [0.35, 0.5, 0.65],
            ),
          ),
        );
      },
    );
  }
}

/// One placeholder row shaped like [AppListRow] — a leading icon-chip
/// circle, a title-width bar, a shorter subtitle-width bar underneath.
class SkeletonListRow extends StatelessWidget {
  const SkeletonListRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
      child: SizedBox(
        height: Spacing.rowHeight,
        child: Row(
          children: [
            const SkeletonBox(width: 40, height: 40, borderRadius: AppShape.lg),
            const SizedBox(width: Spacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SkeletonBox(width: 160, height: 14),
                  const SizedBox(height: Spacing.xs),
                  const SkeletonBox(width: 96, height: 12),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Drop-in replacement for [AsyncValueView]'s default centered spinner on
/// any list-shaped screen — pass as the `skeleton` builder, e.g.
/// `skeleton: (context) => const SkeletonList(rowCount: 4)`.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.rowCount = 5});

  final int rowCount;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      children: [for (var i = 0; i < rowCount; i++) const SkeletonListRow()],
    );
  }
}
