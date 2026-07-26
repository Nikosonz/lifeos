import 'package:flutter/material.dart';

import '../../theme/module_colors.dart';
import '../../theme/semantic_colors.dart';
import '../../theme/tokens/shape.dart';

/// A row action shown behind the trailing overflow menu — e.g. edit/delete.
class RowAction {
  const RowAction({
    required this.label,
    required this.icon,
    required this.onTap,
    this.destructive = false,
  });
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool destructive;
}

/// Standardizes list rows across modules. Two things the audit flagged
/// this fixes: (1) leading icons had no consistent color treatment (some
/// module-colored, most default-gray or unstyled); (2) wallets_tab's
/// delete action lived behind an undiscoverable onLongPress — actions
/// here are always a visible trailing overflow button when [actions] is
/// non-empty, never a hidden gesture.
class AppListRow extends StatelessWidget {
  const AppListRow({
    super.key,
    required this.title,
    this.subtitle,
    this.leadingIcon,
    this.module,
    this.trailing,
    this.actions = const [],
    this.onTap,
  });

  final Widget title;
  final Widget? subtitle;
  final IconData? leadingIcon;
  final ModuleKey? module;
  final Widget? trailing;
  final List<RowAction> actions;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final accent = module != null
        ? context.moduleAccent(module!)
        : Theme.of(context).colorScheme.primary;
    final accentSubtle = module != null
        ? context.moduleAccentSubtle(module!)
        : Theme.of(context).colorScheme.surfaceContainerHighest;

    return ListTile(
      onTap: onTap,
      leading: leadingIcon == null
          ? null
          : Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: accentSubtle,
                borderRadius: AppShape.lg,
              ),
              child: Icon(leadingIcon, size: 20, color: accent),
            ),
      title: title,
      subtitle: subtitle,
      trailing: actions.isEmpty
          ? trailing
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ?trailing,
                PopupMenuButton<RowAction>(
                  icon: const Icon(Icons.more_vert),
                  itemBuilder: (context) => [
                    for (final a in actions)
                      PopupMenuItem(
                        value: a,
                        child: ListTile(
                          leading: Icon(
                            a.icon,
                            color: a.destructive
                                ? Theme.of(context).colorScheme.error
                                : null,
                          ),
                          title: Text(
                            a.label,
                            style: a.destructive
                                ? TextStyle(
                                    color: Theme.of(context).colorScheme.error,
                                  )
                                : null,
                          ),
                        ),
                      ),
                  ],
                  onSelected: (a) => a.onTap(),
                ),
              ],
            ),
    );
  }
}
