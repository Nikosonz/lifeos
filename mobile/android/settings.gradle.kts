import org.gradle.api.initialization.resolve.RepositoriesMode

pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        // Iran: dl.google.com / Maven Central / the plugin portal are blocked.
        // Tencent's maven-public proxies Google + Maven Central + plugin markers
        // (AGP, Kotlin all confirmed reachable). Flutter's own io.flutter
        // artifacts come from FLUTTER_STORAGE_BASE_URL (storage.flutter-io.cn).
        maven { url = uri("https://mirrors.cloud.tencent.com/nexus/repository/maven-public/") }
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "9.0.1" apply false
    id("org.jetbrains.kotlin.android") version "2.3.20" apply false
}

// Some Flutter plugins (e.g. connectivity_plus) ship an old-style android/build.gradle
// that declares its own `buildscript { repositories { google(); mavenCentral() } }` —
// those calls resolve directly to blocked hosts in this environment, bypassing
// pluginManagement's mirror above entirely (that block only covers plugin-portal-style
// resolution, not a subproject's own buildscript classpath deps). PREFER_SETTINGS makes
// Gradle ignore project/subproject-declared repositories in favor of these centrally
// declared ones for every module, so the Tencent mirror (a maven-public proxy already
// covering Google + Maven Central + the plugin portal) is what actually resolves them.
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        maven { url = uri("https://mirrors.cloud.tencent.com/nexus/repository/maven-public/") }
        // PREFER_SETTINGS ignores every project-declared repository, including the one
        // Flutter's own Gradle plugin injects into :app for io.flutter:*_debug/release
        // engine artifacts (FlutterPlugin.kt, driven by FLUTTER_STORAGE_BASE_URL) —
        // without re-declaring it here, the app module itself fails to resolve.
        maven { url = uri("https://storage.flutter-io.cn/download.flutter.io") }
    }
}

include(":app")
