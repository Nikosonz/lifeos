import 'package:flutter/material.dart';

import '../../theme/module_colors.dart';
import '../../theme/semantic_colors.dart';
import '../../theme/tokens/spacing.dart';

/// Replaces the audit's bare `Center(child: Text('هنوز …نساخته‌اید.'))` —
/// every one of those screens already has a FAB the old empty state
/// ignored; [onAction] should call the exact same handler as that FAB so
/// there's one create-flow, not a second undiscovered one.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.message,
    this.hint,
    this.actionLabel,
    this.onAction,
    this.module,
  });

  final IconData icon;
  final String message;
  final String? hint;
  final String? actionLabel;
  final VoidCallback? onAction;
  final ModuleKey? module;

  @override
  Widget build(BuildContext context) {
    final accent = module != null
        ? context.moduleAccent(module!)
        : Theme.of(context).colorScheme.primary;
    final accentSubtle = module != null
        ? context.moduleAccentSubtle(module!)
        : Theme.of(context).colorScheme.surfaceContainerHighest;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Spacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: accentSubtle,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 32, color: accent),
            ),
            const SizedBox(height: Spacing.lg),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            if (hint != null) ...[
              const SizedBox(height: Spacing.xs),
              Text(
                hint!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.colors.neutralCaption,
                ),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: Spacing.lg),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
