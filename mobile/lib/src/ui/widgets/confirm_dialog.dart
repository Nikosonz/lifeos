import 'package:flutter/material.dart';

/// Replaces 5 byte-identical destructive-confirm `AlertDialog`s (wallet/
/// category/transaction/project/task delete) that only ever varied by
/// [title] — same body copy, same انصراف/[confirmLabel] buttons every time.
/// Unlike those hand-rolled copies, the confirm button is themed
/// `colorScheme.error` — the overflow menu's own delete action already was
/// (see `RowAction(destructive: true)`), the confirm dialog itself wasn't.
Future<bool> confirmDestructive(
  BuildContext context, {
  required String title,
  String body = 'این عملیات قابل بازگشت نیست.',
  String confirmLabel = 'حذف',
}) async {
  final scheme = Theme.of(context).colorScheme;
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('انصراف'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: scheme.error,
            foregroundColor: scheme.onError,
          ),
          onPressed: () => Navigator.pop(context, true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return ok ?? false;
}
