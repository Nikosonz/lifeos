import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Proactive offline signal for [AppShell]'s persistent banner — reactive
/// detection (a request that actually failed) already worked before this via
/// `ErrorState`'s `ApiException.status == 0` check; this covers the "nothing
/// has been attempted yet, but the device is known offline" case, e.g. right
/// after airplane mode is toggled on, before any screen re-fetches.
///
/// `none` is the only value that means truly offline — Android can report
/// `[wifi]`/`[mobile]` while the interface is up but has no route to the
/// internet (captive portal, etc.), which this deliberately doesn't try to
/// distinguish; that case still surfaces via a failed request's `status: 0`.
final isOfflineProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  bool offline(List<ConnectivityResult> results) =>
      results.every((r) => r == ConnectivityResult.none);

  // onConnectivityChanged only emits on *changes* — without this initial
  // check, a device that's offline before the app even launches would sit
  // in AsyncLoading (banner hidden) until the next connectivity flip.
  yield offline(await connectivity.checkConnectivity());
  yield* connectivity.onConnectivityChanged.map(offline);
});
