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
}
