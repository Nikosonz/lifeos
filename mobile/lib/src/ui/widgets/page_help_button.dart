import 'package:flutter/material.dart';

import '../../theme/tokens/spacing.dart';

/// The mobile port of web's PageHelp — a "?" icon opening a dialog with a
/// flat bulleted list, same content shape (title + short factual items,
/// no headings/sub-sections). Unlike web (one `<PageHelp pageKey="x" />`
/// call site per page/route), this is mounted ONCE in AppShell's AppBar
/// and re-keyed off the active bottom-nav destination — mobile's module
/// screens already share one AppBar, so there's no per-screen file to put
/// a separate instance in.
class PageHelpButton extends StatelessWidget {
  const PageHelpButton({super.key, required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'راهنما',
      icon: const Icon(Icons.help_outline),
      onPressed: () => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: Spacing.sm),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('•  '),
                      Expanded(
                        child: Text(
                          item,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('متوجه شدم'),
            ),
          ],
        ),
      ),
    );
  }
}
