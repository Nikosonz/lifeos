import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import 'error_state.dart';

/// Runs a mutation and tells the user when it fails.
///
/// Without this an exception thrown by a repository call escapes into the
/// zone: the telemetry hooks record it, whatever `invalidate*` call followed
/// never runs, and the user sees *nothing at all* — the row just sits there
/// unchanged, as if the tap had missed. That was survivable while mutations
/// only failed on a dropped connection. Optimistic concurrency (ADR-0020)
/// makes a routine, fully expected failure — another device wrote first —
/// arrive at these same call sites, and silently doing nothing is the worst
/// available response to it: the user's edit is gone and they have no way to
/// know.
///
/// This is the same try/catch + `friendlyErrorMessage` snackbar that
/// `settings_screen.dart` already hand-writes three times; it is extracted
/// here rather than copied an eighth time.
///
/// Returns whether [action] completed, so a caller that navigates on success
/// (closing a detail sheet after deleting the thing it was showing) can tell
/// the two outcomes apart. Callers should still invalidate their providers
/// *unconditionally*: after a success the list has changed, and after a
/// version conflict the local copy is precisely what is stale — refetching is
/// what makes the message's "try again" actionable rather than advice to go
/// and pull-to-refresh manually.
Future<bool> runMutation(
  BuildContext context,
  Future<void> Function() action,
) async {
  try {
    await action();
    return true;
  } on ApiException catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(friendlyErrorMessage(e))));
    }
    return false;
  }
}
