import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../generated/generated.dart';

const _bufferKey = 'lifeos:telemetry-crash-buffer';

/// Matches `TelemetryCrashBatchInput`'s server-side cap, so a full buffer is
/// always flushable in exactly one request. Oldest reports are dropped first
/// when it overflows: in a crash loop the first failure is the informative
/// one, and the twentieth repeat adds nothing.
const int maxBufferedCrashes = 20;

/// Crash reports written to disk at crash time and sent on the **next**
/// launch — a process that just failed can rarely complete a network call,
/// and retrying inside a broken app risks compounding the failure.
///
/// Backed by [SharedPreferences] rather than `path_provider` + `dart:io`:
/// it is already a dependency (adding one more plugin has real cost in this
/// repo's network-constrained Gradle setup — see the `mobile` skill), it is
/// disk-backed all the same, and the async write is not a problem here
/// because neither `FlutterError.onError` nor `PlatformDispatcher.onError`
/// terminates the isolate — Flutter keeps running after both, so there is
/// time for the write to land.
///
/// **Known limitation, deliberate:** a hard native crash or an OOM kill
/// takes the process down without either Dart handler ever running, so it is
/// never captured. Catching those needs a native (JNI/NDK) crash handler,
/// which is well outside this module's scope — see ADR-0017.
class CrashBuffer {
  final SharedPreferences _prefs;
  CrashBuffer(this._prefs);

  List<TelemetryCrashInput> read() {
    final raw = _prefs.getString(_bufferKey);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw) as List<dynamic>;
      return decoded
          .map(
            (e) => TelemetryCrashInput.fromJson(
              (e as Map).cast<String, dynamic>(),
            ),
          )
          .toList();
    } catch (_) {
      // A malformed buffer is unrecoverable and worth exactly nothing, but it
      // must not wedge every future launch trying to parse it. Drop it.
      _prefs.remove(_bufferKey);
      return const [];
    }
  }

  Future<void> add(TelemetryCrashInput crash) async {
    final existing = [...read(), crash];
    final trimmed = existing.length > maxBufferedCrashes
        ? existing.sublist(existing.length - maxBufferedCrashes)
        : existing;
    await _prefs.setString(
      _bufferKey,
      jsonEncode(trimmed.map((c) => c.toJson()).toList()),
    );
  }

  Future<void> clear() => _prefs.remove(_bufferKey);
}
