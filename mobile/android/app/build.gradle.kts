import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// android/key.properties (gitignored — see android/.gitignore) holds the real release
// keystore credentials. It now exists on the maintainer's dev machine and points at a
// keystore stored OUTSIDE the repository; it is still absent in CI, which never builds a
// release artifact. See CLAUDE.md's Secret Hygiene section for why neither the keystore
// nor this file is ever committed.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
}

android {
    namespace = "ir.maaleto.app"
    compileSdk = flutter.compileSdkVersion
    // Required even with zero JNI code of our own — every Flutter APK
    // bundles the engine's native libflutter.so, and AGP needs the NDK
    // toolchain (strip/objcopy) to package it. The build failure this line
    // seemed to cause was actually a corrupted partial NDK download at
    // D:\Android\ndk\28.2.13676358 (missing source.properties); fixed by
    // deleting it and reinstalling via sdkmanager through the Tencent
    // mirror, not by removing this.
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "ir.maaleto.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Real release signing when key.properties exists (a real keystore, e.g. for
            // a Cafe Bazaar/Myket upload). Falls back to the DEBUG keystore otherwise —
            // but that fallback is now gated, see the guard below. Once a real keystore
            // exists, every future release build MUST use the same key.properties —
            // Android and the stores reject an update signed with a different key than
            // the original upload.
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Release-signing guard.
//
// The debug fallback above is convenient on a dev machine and genuinely
// dangerous at a store. A debug keystore is generated per-machine, is not
// backed up anywhere, and its password is public knowledge. Publishing an APK
// signed with it permanently binds the Cafe Bazaar / Myket listing to a key
// that cannot be reproduced if the machine is lost — and Android refuses any
// update signed with a different key. That is unrecoverable: the only remedy
// is a new listing, losing every install, rating and review.
//
// Nothing about a debug-signed `app-release.apk` looks wrong. Same filename,
// same path, builds cleanly. The whole failure mode is that it is silent, so
// the fix is to make it loud.
//
// Escape hatch: -PallowDebugSigning=true. Needed for `flutter run --release`
// and for profiling release performance on a machine without the keystore.
// It is opt-in per invocation rather than a file someone can leave lying
// around, and it renames the output so a bypassed build cannot be mistaken
// for a publishable one later.
val allowDebugSigning = project.hasProperty("allowDebugSigning")

// A debug-signed artifact must never be confusable with a publishable one on
// disk — the guard above stops the accident, this marks the deliberate bypass.
//
// This originally renamed the APK through `applicationVariants`, which does not
// exist under AGP's new DSL (the default from AGP 9). A Kotlin build script is
// compiled as a unit, so that unresolved reference failed script compilation
// and broke EVERY Gradle task on this module — debug builds and `flutter run`
// included — not merely the guarded path it sat inside. It was never caught
// because `flutter analyze` and `flutter test` don't invoke Gradle at all.
//
// A sibling marker file is pure file I/O: no AGP surface to drift out from
// under it, and it leaves the APK named exactly as Flutter's own tooling
// expects, so the bypass can't break the build a second way.
//
// BOTH output directories are marked, and that is the whole point rather than
// belt-and-braces. `flutter build apk` produces two copies of the artifact:
// AGP writes outputs/apk/release/, then Flutter copies to outputs/flutter-apk/
// — and flutter-apk/ is the path Flutter's own success line prints, so it is
// the copy a developer actually opens. Marking only AGP's directory left the
// copy people are pointed at completely unmarked, which defeated the purpose
// in the one place it mattered. Confirmed by running the bypass and inspecting
// both copies: identical APKs, both CN=Android Debug, one warning between them.
//
// flutter-apk/ may not exist yet at doLast time, since Flutter's copy step runs
// after Gradle returns. Creating it early is harmless — the copy lands beside
// the marker rather than replacing it.
val debugSignedMarkerDirs = listOf(
    layout.buildDirectory.dir("outputs/apk/release"),
    layout.buildDirectory.dir("outputs/flutter-apk"),
)

// The hook is registered unconditionally and branches inside, because a stale
// marker is its own failure mode. AGP cleans outputs/apk/release/ on rebuild,
// but Flutter only ever COPIES into outputs/flutter-apk/ — it never prunes it.
// So a bypassed build followed by a real one previously left a correctly-signed
// APK sitting beside a file insisting it was debug-signed. A warning that lies
// is worse than no warning: it is the fastest way to teach someone to ignore
// this file. Found by running bypass -> real in sequence; either path alone
// looks correct.
tasks.matching { it.name == "assembleRelease" }.configureEach {
    doLast {
        val debugSigned = !keystorePropertiesFile.exists() && allowDebugSigning
        for (provider in debugSignedMarkerDirs) {
            val dir = provider.get().asFile
            val marker = dir.resolve("DO-NOT-PUBLISH-debug-signed.txt")
            if (debugSigned) {
                dir.mkdirs()
                marker.writeText(
                    """
                    |This APK was signed with the DEBUG keystore, via -PallowDebugSigning=true.
                    |
                    |It is usable for profiling and `flutter run --release` ONLY. Publishing it
                    |to Cafe Bazaar or Myket permanently binds the listing to a per-machine,
                    |un-backed-up key whose password is public knowledge. Android refuses any
                    |update signed with a different key, so the only remedy is a new listing
                    |with zero installs, ratings and reviews.
                    |
                    |Delete this file only along with the APK beside it.
                    """.trimMargin(),
                )
            } else {
                marker.delete()
            }
        }
        if (debugSigned) {
            logger.warn(
                "\n*** app-release.apk is DEBUG-SIGNED (-PallowDebugSigning=true). " +
                    "Do not publish it. See DO-NOT-PUBLISH-debug-signed.txt. ***\n",
            )
        }
    }
}

gradle.taskGraph.whenReady {
    val isReleaseAssemble = allTasks.any {
        it.project == project && (it.name == "assembleRelease" || it.name == "bundleRelease")
    }
    if (isReleaseAssemble && !keystorePropertiesFile.exists() && !allowDebugSigning) {
        throw GradleException(
            """
            |
            |Refusing to build a release artifact without a release keystore.
            |
            |android/key.properties is missing, so this build would be signed with the
            |DEBUG keystore. Publishing that to Cafe Bazaar or Myket permanently locks the
            |listing to a per-machine, un-backed-up key — an unrecoverable mistake.
            |
            |To publish:  create android/key.properties (keyAlias, keyPassword, storeFile,
            |             storePassword) and make sure the keystore itself is backed up
            |             somewhere off this machine.
            |
            |To build a throwaway release APK anyway (profiling, `flutter run --release`):
            |             pass -PallowDebugSigning=true
            |             The output is renamed app-release-UNSIGNED-DO-NOT-PUBLISH.apk.
            """.trimMargin(),
        )
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
