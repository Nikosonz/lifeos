import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers.dart';
import '../../theme/tokens/motion.dart';
import '../../theme/tokens/shape.dart';
import '../../theme/tokens/spacing.dart';

/// One spotlighted step. [targetKey] null = a centered, non-spotlit step
/// (only the welcome step uses this).
class OnboardingStep {
  const OnboardingStep({
    this.targetKey,
    required this.title,
    required this.body,
  });
  final GlobalKey? targetKey;
  final String title;
  final String body;
}

const _cardWidth = 300.0;
const _cardEstHeight = 190.0;
const _spotlightPad = 6.0;

/// Ports apps/web/src/app/[locale]/(app)/_components/onboarding-tour.tsx's
/// spotlight technique to Flutter: a box with zero fill and a huge
/// BoxShadow.spreadRadius is the direct analog of the web's CSS
/// `box-shadow: 0 0 0 9999px rgba(0,0,0,.6)` cutout trick — the shadow
/// fills the rest of the screen, leaving only the target's own rect (plus
/// a small pad) unshadowed. Mounted once in AppShell, gated by
/// tutorialSeenProvider; shows itself ~1.5s after first build (letting the
/// shell finish laying out before measuring targets) — same delay and
/// same reason as the web version.
///
/// No keyboard shortcuts (the web's Escape/ArrowLeft/ArrowRight): a
/// touch-first surface's primary interaction is tapping, and Android
/// hardware/gesture back is handled below instead of a keyboard event.
class OnboardingOverlay extends ConsumerStatefulWidget {
  const OnboardingOverlay({super.key, required this.steps});
  final List<OnboardingStep> steps;

  @override
  ConsumerState<OnboardingOverlay> createState() => _OnboardingOverlayState();
}

class _OnboardingOverlayState extends ConsumerState<OnboardingOverlay> {
  bool _active = false;
  int _step = 0;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted && !ref.read(tutorialSeenProvider)) {
        setState(() => _active = true);
      }
    });
  }

  Rect? _measure(GlobalKey? key) {
    if (key == null) return null;
    final box = key.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || box.size.isEmpty) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }

  void _finish() {
    ref.read(tutorialSeenProvider.notifier).markSeen();
    setState(() => _active = false);
  }

  void _next() {
    if (_step >= widget.steps.length - 1) {
      _finish();
    } else {
      setState(() => _step += 1);
    }
  }

  void _back() => setState(() => _step = math.max(0, _step - 1));

  ({double left, double top})? _cardPosition(Rect? rect, Size screen) {
    if (rect == null) return null; // centered instead — see _TooltipCard
    final left = (rect.left + rect.width / 2 - _cardWidth / 2).clamp(
      12.0,
      screen.width - _cardWidth - 12.0,
    );
    final placeAbove = rect.bottom + 200 > screen.height;
    final top = placeAbove
        ? (rect.top - 12 - _cardEstHeight).clamp(
            12.0,
            screen.height - _cardEstHeight - 12.0,
          )
        : (rect.bottom + 12).clamp(12.0, screen.height - _cardEstHeight - 12.0);
    return (left: left, top: top);
  }

  @override
  Widget build(BuildContext context) {
    // Manual replay from the overflow menu's "نمایش راهنما" item — a
    // signal-counter change (not its value) means "show it now", regardless
    // of whether tutorialSeenProvider is already true. Deliberately
    // ref.listen, not ref.watch: the persisted "seen" flag itself must never
    // gate this build once the auto-show decision has already been made in
    // initState, or a completed tour could never be replayed.
    ref.listen<int>(tourRestartSignalProvider, (previous, next) {
      if (previous != null && next != previous) {
        setState(() {
          _step = 0;
          _active = true;
        });
      }
    });

    if (!_active) {
      return const SizedBox.shrink();
    }

    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final step = widget.steps[_step];
    final rect = _measure(step.targetKey);
    final screen = MediaQuery.of(context).size;

    return Positioned.fill(
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _finish();
        },
        child: Stack(
          children: [
            // A tap-to-dismiss layer, always present and always a direct
            // Stack child (Positioned/AnimatedPositioned only apply their
            // geometry when they're a *direct* Stack child — wrapping this
            // in GestureDetector threw "Incorrect use of ParentDataWidget"
            // at runtime, caught by the framework and silently skipped, so
            // the spotlight never painted at all). When there's no target,
            // this layer itself provides the dim; when there is one, the
            // dim comes entirely from the spotlight box below instead, so
            // this stays transparent but still tappable everywhere.
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _finish,
                child: rect == null
                    ? Container(color: Colors.black.withValues(alpha: 0.6))
                    : null,
              ),
            ),
            if (rect != null)
              AnimatedPositioned(
                duration: reduceMotion ? Duration.zero : AppMotion.standard,
                curve: AppMotion.standardCurve,
                left: rect.left - _spotlightPad,
                top: rect.top - _spotlightPad,
                width: rect.width + _spotlightPad * 2,
                height: rect.height + _spotlightPad * 2,
                // IgnorePointer so a tap here falls through to the
                // full-screen layer above (dismissing the tour) — matches
                // the web version, where tapping the spotlighted area
                // itself also closes the tour early.
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: AppShape.lg,
                      border: Border.all(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.6),
                          spreadRadius: 2000,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            _TooltipCard(
              key: ValueKey(_step),
              step: step,
              stepIndex: _step,
              stepCount: widget.steps.length,
              position: _cardPosition(rect, screen),
              duration: reduceMotion ? Duration.zero : AppMotion.quick,
              onSkip: _finish,
              onBack: _step > 0 ? _back : null,
              onNext: _next,
            ),
          ],
        ),
      ),
    );
  }
}

class _TooltipCard extends StatelessWidget {
  const _TooltipCard({
    super.key,
    required this.step,
    required this.stepIndex,
    required this.stepCount,
    required this.position,
    required this.duration,
    required this.onSkip,
    required this.onBack,
    required this.onNext,
  });

  final OnboardingStep step;
  final int stepIndex;
  final int stepCount;
  final ({double left, double top})? position;
  final Duration duration;
  final VoidCallback onSkip;
  final VoidCallback? onBack;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final card = TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: duration,
      curve: AppMotion.quickCurve,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, (1 - t) * 16),
          child: child,
        ),
      ),
      child: _CardContent(
        step: step,
        stepIndex: stepIndex,
        stepCount: stepCount,
        onSkip: onSkip,
        onBack: onBack,
        onNext: onNext,
      ),
    );

    if (position == null) {
      return Center(
        child: SizedBox(width: _cardWidth, child: card),
      );
    }
    return Positioned(
      left: position!.left,
      top: position!.top,
      width: _cardWidth,
      child: card,
    );
  }
}

class _CardContent extends StatelessWidget {
  const _CardContent({
    required this.step,
    required this.stepIndex,
    required this.stepCount,
    required this.onSkip,
    required this.onBack,
    required this.onNext,
  });

  final OnboardingStep step;
  final int stepIndex;
  final int stepCount;
  final VoidCallback onSkip;
  final VoidCallback? onBack;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final isLast = stepIndex == stepCount - 1;
    final isFirst = stepIndex == 0;
    final scheme = Theme.of(context).colorScheme;

    return GestureDetector(
      // Absorbs taps so the card itself doesn't bubble to the backdrop's
      // GestureDetector and dismiss the tour when tapping inside it.
      onTap: () {},
      child: Material(
        color: scheme.surface,
        borderRadius: AppShape.xl,
        elevation: 4,
        child: Padding(
          padding: const EdgeInsets.all(Spacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      step.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    tooltip: 'بستن',
                    visualDensity: VisualDensity.compact,
                    onPressed: onSkip,
                  ),
                ],
              ),
              const SizedBox(height: Spacing.xs),
              Text(step.body, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: Spacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < stepCount; i++)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: AnimatedContainer(
                        duration: AppMotion.quick,
                        width: i == stepIndex ? 16 : 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: i == stepIndex
                              ? scheme.primary
                              : scheme.outlineVariant,
                          borderRadius: AppShape.sm,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: Spacing.sm),
              Row(
                children: [
                  if (onBack != null)
                    TextButton(onPressed: onBack, child: const Text('قبلی')),
                  const Spacer(),
                  FilledButton(
                    onPressed: onNext,
                    child: Text(
                      isLast ? 'متوجه شدم' : (isFirst ? 'شروع راهنما' : 'بعدی'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
