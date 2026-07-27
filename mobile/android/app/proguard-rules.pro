# Flutter's own Gradle plugin auto-applies its own consumer ProGuard rules for the engine
# and platform-channel plumbing (io.flutter.**), so nothing is needed here for Flutter
# itself. dio's HTTP calls run through Dart's own dart:io networking (no Java-side HTTP
# reflection), so it needs no rule either.

# flutter_secure_storage (Android Keystore-backed token storage — see
# mobile/lib/src/auth/token_store.dart) uses reflection internally; without this rule R8
# can strip methods it needs at runtime, breaking token read/write silently in release
# builds only (never reproduces in debug, where minification is off).
-keep class com.it_nomads.fluttersecurestorage.** { *; }
