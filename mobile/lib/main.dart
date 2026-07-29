import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'src/app.dart';
import 'src/generated/generated.dart';
import 'src/providers.dart';

/// Entry point, now with the global error handling the app previously had
/// none of: before this, an uncaught async error was swallowed in silence and
/// an uncaught build error only produced Flutter's default error widget,
/// logged nowhere and reported nowhere (ADR-0017).
///
/// All three hooks are installed because they cover different failure classes
/// and none subsumes the others:
///   - `FlutterError.onError` — synchronous framework/build/layout errors.
///   - `PlatformDispatcher.instance.onError` — uncaught async errors that
///     reach the platform, which is most `Future` failures.
///   - `runZonedGuarded`'s own handler — the remainder, for errors raised in
///     this zone that neither hook claimed.
void main() async {
  // Hoisted out of the zone body so `runZonedGuarded`'s own handler can
  // report too. It is null only for the brief window before init completes;
  // an error that early has nowhere to be stored anyway.
  ProviderContainer? container;

  void report(TelemetryCrashKind kind, Object error, StackTrace? stack) {
    // Fire-and-forget: this runs on an error path, so awaiting a disk write
    // here would add one more thing that can fail while already failing.
    // The controller no-ops entirely when telemetry is off.
    final c = container;
    if (c == null) return;
    unawaited(
      c
          .read(telemetryControllerProvider)
          .recordCrash(kind: kind, error: error, stackTrace: stack),
    );
  }

  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      final prefs = await SharedPreferences.getInstance();

      // An explicit container rather than a plain ProviderScope: the error
      // hooks are installed outside the widget tree and still need to reach
      // TelemetryController, which only a container can give them.
      container = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );

      FlutterError.onError = (details) {
        // Hand it to Flutter's own presenter first — in debug that is the red
        // error screen, and losing it would make development strictly worse
        // in exchange for telemetry nobody reads locally.
        FlutterError.presentError(details);
        report(
          TelemetryCrashKind.FLUTTER_ERROR,
          details.exception,
          details.stack,
        );
      };

      PlatformDispatcher.instance.onError = (error, stack) {
        report(TelemetryCrashKind.UNCAUGHT_ASYNC, error, stack);
        // true = handled. Returning false lets the platform terminate the app
        // over an error the UI can usually survive.
        return true;
      };

      runApp(
        UncontrolledProviderScope(
          container: container!,
          child: const LifeOsApp(),
        ),
      );
    },
    (error, stack) {
      // Not a formality — this is the handler that actually fires for an
      // unawaited `Future.error` raised inside the zone, which reaches
      // neither of the hooks above. Verified on a real device: a deliberate
      // crash logged "Uncaught zone error" here and was reported nowhere
      // until this path started calling report() too.
      debugPrint('Uncaught zone error: $error\n$stack');
      report(TelemetryCrashKind.UNCAUGHT_ASYNC, error, stack);
    },
  );
}
