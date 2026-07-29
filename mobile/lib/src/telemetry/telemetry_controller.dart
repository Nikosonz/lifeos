import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

import '../api/api_exception.dart';
import '../config/env.dart';
import '../generated/generated.dart';
import 'crash_buffer.dart';
import 'telemetry_repository.dart';

/// Events are flushed once this many are queued, or on the next app-lifecycle
/// flush point, whichever comes first — batching is ADR-0017's requirement.
const int _eventFlushThreshold = 10;

/// Client half of the telemetry module: decides *when* to send, holds the
/// opt-out, and owns the in-memory event queue. The repository does the HTTP;
/// the server does the storing.
///
/// Every entry point is a no-op when [enabled] is false — the check happens
/// before anything is buffered or queued, so opting out means nothing is
/// collected at all, not collected-then-discarded server-side. That is the
/// stronger guarantee and the one the privacy policy claims.
class TelemetryController {
  final TelemetryRepository _repository;
  final CrashBuffer _crashBuffer;
  bool Function() _isEnabled;

  TelemetryController(this._repository, this._crashBuffer, this._isEnabled);

  /// Analytics events live in memory only. Unlike crashes, losing a handful
  /// on an abrupt kill is an acceptable trade for not writing to disk on
  /// every tap — an event is a usage signal, not a diagnosis.
  final List<TelemetryEventInput> _pendingEvents = [];

  bool get enabled => _isEnabled();

  @visibleForTesting
  set isEnabledOverride(bool Function() fn) => _isEnabled = fn;

  @visibleForTesting
  int get pendingEventCount => _pendingEvents.length;

  String get _platform => Platform.operatingSystem;

  /// Records a crash to disk. Never sends immediately: see [CrashBuffer].
  Future<void> recordCrash({
    required TelemetryCrashKind kind,
    required Object error,
    required StackTrace? stackTrace,
  }) async {
    if (!enabled) return;
    // A StackTrace can stringify to empty — `Future.error` raised without one
    // does exactly that, and it reaches the zone handler with a non-null but
    // blank trace. `TelemetryCrashInput.stackTrace` is `.min(1)` server-side,
    // so sending it verbatim makes the whole batch a permanent 400. Found on
    // a real device, not by any unit test.
    final trace = (stackTrace ?? StackTrace.current).toString().trim();
    await _crashBuffer.add(
      TelemetryCrashInput(
        kind: kind,
        message: error.toString(),
        stackTrace: trace.isEmpty ? '<no stack trace available>' : trace,
        appVersion: Env.appVersion,
        platform: _platform,
        // dart:io gives the OS version with no extra plugin; the device model
        // would need device_info_plus, which isn't worth a dependency until
        // something actually segments crashes by hardware.
        osVersion: Platform.operatingSystemVersion,
        occurredAt: DateTime.now().toUtc(),
      ),
    );
  }

  /// Sends anything buffered by a previous session, then clears it. Called
  /// once the user is known to be authenticated — the ingest routes are
  /// Bearer-authenticated, so flushing while logged out would only 401.
  Future<void> flushBufferedCrashes() async {
    if (!enabled) return;
    final buffered = _crashBuffer.read();
    if (buffered.isEmpty) return;
    try {
      await _repository.sendCrashes(buffered);
      await _crashBuffer.clear();
    } on ApiException catch (e) {
      // A 4xx means the server will never accept these reports — a malformed
      // one poisons every future flush, since the whole batch is rejected
      // together. Drop them rather than retrying forever. (A real instance:
      // an empty stack trace failing the contract's `.min(1)`, which is why
      // recordCrash now guards against that above.)
      //
      // 401 is the exception: that just means the token expired mid-flush,
      // and the reports are perfectly good on the next authenticated try.
      if (e.status >= 400 && e.status < 500 && e.status != 401) {
        await _crashBuffer.clear();
      }
    } catch (_) {
      // Network/5xx: kept on disk for the next launch rather than dropped.
      // The usual cause is being offline, and a crash report is still worth
      // having tomorrow. The buffer is capped, so retrying cannot grow
      // without bound.
    }
  }

  /// Queues a typed event, flushing automatically once enough accumulate.
  Future<void> track(TelemetryEventName name) async {
    if (!enabled) return;
    _pendingEvents.add(
      TelemetryEventInput(
        name: name,
        appVersion: Env.appVersion,
        platform: _platform,
        occurredAt: DateTime.now().toUtc(),
      ),
    );
    if (_pendingEvents.length >= _eventFlushThreshold) {
      await flushEvents();
    }
  }

  Future<void> flushEvents() async {
    if (!enabled || _pendingEvents.isEmpty) return;
    // Drained before the request, not after: a failed send drops the batch
    // rather than retrying. Analytics is best-effort by design — retry
    // machinery here would be more moving parts than the data is worth, and
    // a stuck queue would grow unbounded in memory.
    final batch = List<TelemetryEventInput>.from(_pendingEvents);
    _pendingEvents.clear();
    try {
      await _repository.sendEvents(batch);
    } catch (_) {
      // Intentionally swallowed — see above.
    }
  }

  /// Drops anything queued but not yet sent. Called the moment a user opts
  /// out, so turning it off also discards what was already collected in this
  /// session rather than letting it flush later.
  void discardPending() => _pendingEvents.clear();
}
