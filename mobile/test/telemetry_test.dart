import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lifeos/src/api/api_client.dart';
import 'package:lifeos/src/api/api_exception.dart';
import 'package:lifeos/src/generated/generated.dart';
import 'package:lifeos/src/telemetry/crash_buffer.dart';
import 'package:lifeos/src/telemetry/telemetry_controller.dart';
import 'package:lifeos/src/telemetry/telemetry_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Subclasses the real repository rather than reimplementing it — only the
// two send methods are exercised, and this keeps the fake honest if their
// signatures ever change.
class _FakeTelemetryRepository extends TelemetryRepository {
  _FakeTelemetryRepository({this.fail = false, this.failWithStatus})
    : super(ApiClient(Dio()));

  final bool fail;

  /// When set, sendCrashes throws an ApiException with this status instead of
  /// a plain network error — the two are handled differently on purpose.
  final int? failWithStatus;
  final List<List<TelemetryCrashInput>> sentCrashes = [];
  final List<List<TelemetryEventInput>> sentEvents = [];

  @override
  Future<int> sendCrashes(List<TelemetryCrashInput> crashes) async {
    final status = failWithStatus;
    if (status != null) {
      throw ApiException('VALIDATION_ERROR', 'bad', status, 'req-1');
    }
    if (fail) throw Exception('offline');
    sentCrashes.add(crashes);
    return crashes.length;
  }

  @override
  Future<int> sendEvents(List<TelemetryEventInput> events) async {
    if (fail) throw Exception('offline');
    sentEvents.add(events);
    return events.length;
  }
}

Future<CrashBuffer> _buffer() async {
  SharedPreferences.setMockInitialValues({});
  return CrashBuffer(await SharedPreferences.getInstance());
}

void main() {
  test('recordCrash buffers to disk instead of sending immediately', () async {
    final buffer = await _buffer();
    final repo = _FakeTelemetryRepository();
    final controller = TelemetryController(repo, buffer, () => true);

    await controller.recordCrash(
      kind: TelemetryCrashKind.FLUTTER_ERROR,
      error: Exception('boom'),
      stackTrace: StackTrace.current,
    );

    // The whole point: a process that just failed can rarely complete a
    // network call, so nothing is sent at crash time.
    expect(repo.sentCrashes, isEmpty);
    expect(buffer.read(), hasLength(1));
    expect(buffer.read().first.kind, TelemetryCrashKind.FLUTTER_ERROR);
  });

  test(
    'flushBufferedCrashes sends what a previous session buffered, then clears',
    () async {
      final buffer = await _buffer();
      final repo = _FakeTelemetryRepository();
      final controller = TelemetryController(repo, buffer, () => true);

      await controller.recordCrash(
        kind: TelemetryCrashKind.UNCAUGHT_ASYNC,
        error: Exception('boom'),
        stackTrace: StackTrace.current,
      );
      await controller.flushBufferedCrashes();

      expect(repo.sentCrashes, hasLength(1));
      expect(repo.sentCrashes.first, hasLength(1));
      expect(buffer.read(), isEmpty);
    },
  );

  test('a failed flush keeps the buffer for the next launch', () async {
    final buffer = await _buffer();
    final repo = _FakeTelemetryRepository(fail: true);
    final controller = TelemetryController(repo, buffer, () => true);

    await controller.recordCrash(
      kind: TelemetryCrashKind.FLUTTER_ERROR,
      error: Exception('boom'),
      stackTrace: StackTrace.current,
    );
    await controller.flushBufferedCrashes();

    // Being offline is the usual reason this fails, and a crash report is
    // still worth having tomorrow — so it must survive, not be dropped.
    expect(buffer.read(), hasLength(1));
  });

  test(
    'the crash buffer is capped, dropping the oldest reports first',
    () async {
      final buffer = await _buffer();
      final controller = TelemetryController(
        _FakeTelemetryRepository(),
        buffer,
        () => true,
      );

      for (var i = 0; i < maxBufferedCrashes + 5; i++) {
        await controller.recordCrash(
          kind: TelemetryCrashKind.FLUTTER_ERROR,
          error: Exception('boom $i'),
          stackTrace: StackTrace.current,
        );
      }

      final stored = buffer.read();
      expect(stored, hasLength(maxBufferedCrashes));
      // In a crash loop the newest reports are kept; the first failures are
      // dropped once the cap is hit.
      expect(stored.last.message, contains('boom ${maxBufferedCrashes + 4}'));
    },
  );

  test(
    'events batch in memory and flush once the threshold is reached',
    () async {
      final buffer = await _buffer();
      final repo = _FakeTelemetryRepository();
      final controller = TelemetryController(repo, buffer, () => true);

      for (var i = 0; i < 9; i++) {
        await controller.track(TelemetryEventName.APP_OPENED);
      }
      expect(repo.sentEvents, isEmpty, reason: 'below the flush threshold');

      await controller.track(TelemetryEventName.TASK_CREATED);
      expect(repo.sentEvents, hasLength(1));
      expect(repo.sentEvents.first, hasLength(10));
      expect(controller.pendingEventCount, 0);
    },
  );

  test(
    'opting out collects nothing at all, rather than collecting then discarding',
    () async {
      final buffer = await _buffer();
      final repo = _FakeTelemetryRepository();
      final controller = TelemetryController(repo, buffer, () => false);

      await controller.recordCrash(
        kind: TelemetryCrashKind.FLUTTER_ERROR,
        error: Exception('boom'),
        stackTrace: StackTrace.current,
      );
      await controller.track(TelemetryEventName.APP_OPENED);
      await controller.flushBufferedCrashes();
      await controller.flushEvents();

      // Nothing buffered, nothing queued, nothing sent — the stronger
      // guarantee the privacy policy actually claims.
      expect(buffer.read(), isEmpty);
      expect(controller.pendingEventCount, 0);
      expect(repo.sentCrashes, isEmpty);
      expect(repo.sentEvents, isEmpty);
    },
  );

  test('discardPending drops queued events that were never sent', () async {
    final buffer = await _buffer();
    final repo = _FakeTelemetryRepository();
    final controller = TelemetryController(repo, buffer, () => true);

    await controller.track(TelemetryEventName.APP_OPENED);
    expect(controller.pendingEventCount, 1);

    controller.discardPending();

    expect(controller.pendingEventCount, 0);
    expect(repo.sentEvents, isEmpty);
  });

  test('an empty stack trace is replaced, never sent as-is', () async {
    final buffer = await _buffer();
    final controller = TelemetryController(
      _FakeTelemetryRepository(),
      buffer,
      () => true,
    );

    // `Future.error` raised with no trace reaches the zone handler with a
    // non-null but blank StackTrace. Sent verbatim it fails the contract's
    // `.min(1)` and poisons every future flush — found on a real device.
    await controller.recordCrash(
      kind: TelemetryCrashKind.UNCAUGHT_ASYNC,
      error: StateError('boom'),
      stackTrace: StackTrace.fromString(''),
    );

    expect(buffer.read().single.stackTrace, isNotEmpty);
  });

  test(
    'a 4xx rejection drops the batch instead of retrying it forever',
    () async {
      final buffer = await _buffer();
      final controller = TelemetryController(
        _FakeTelemetryRepository(failWithStatus: 400),
        buffer,
        () => true,
      );

      await controller.recordCrash(
        kind: TelemetryCrashKind.FLUTTER_ERROR,
        error: Exception('boom'),
        stackTrace: StackTrace.current,
      );
      await controller.flushBufferedCrashes();

      // The server will never accept these, and one bad report rejects the
      // whole batch — keeping them would block every future flush.
      expect(buffer.read(), isEmpty);
    },
  );

  test(
    'a 401 keeps the batch, since the token may simply have expired',
    () async {
      final buffer = await _buffer();
      final controller = TelemetryController(
        _FakeTelemetryRepository(failWithStatus: 401),
        buffer,
        () => true,
      );

      await controller.recordCrash(
        kind: TelemetryCrashKind.FLUTTER_ERROR,
        error: Exception('boom'),
        stackTrace: StackTrace.current,
      );
      await controller.flushBufferedCrashes();

      expect(buffer.read(), hasLength(1));
    },
  );

  test(
    'a corrupt buffer is discarded rather than wedging every launch',
    () async {
      SharedPreferences.setMockInitialValues({
        'lifeos:telemetry-crash-buffer': 'not json at all',
      });
      final buffer = CrashBuffer(await SharedPreferences.getInstance());

      expect(buffer.read(), isEmpty);
    },
  );
}
