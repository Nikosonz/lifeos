/// Where the app talks to the LifeOS backend. Overridable at build/run time:
///   flutter run -d windows --dart-define=API_BASE_URL=http://localhost:3000
///
/// Windows desktop uses dart:io (no CORS), so it can hit localhost directly.
/// On the Android emulator this becomes http://10.0.2.2:3000 (the emulator's
/// alias for the host machine); on a physical device it becomes the VPS URL.
class Env {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  /// Stamped onto every telemetry report so a crash can be attributed to a
  /// build. A `--dart-define` with a literal fallback rather than
  /// `package_info_plus`: reading the real version needs another plugin, and
  /// this is one string that CI can inject at build time. **Keep the
  /// fallback in sync with `pubspec.yaml`'s `version:`** — it is the value
  /// every local/debug build reports.
  static const String appVersion = String.fromEnvironment(
    'APP_VERSION',
    defaultValue: '1.0.0',
  );
}
