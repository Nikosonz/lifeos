import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// android/key.properties (gitignored — see android/.gitignore) holds the real release
// keystore credentials. Absent on this dev machine and in CI, so release signing falls
// back to the debug keystore below rather than failing the build — see CLAUDE.md's Secret
// Hygiene section for why a real keystore is never committed.
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

if (!keystorePropertiesFile.exists() && allowDebugSigning) {
    android.buildTypes.getByName("release") {
        // A debug-signed artifact must never be confusable with a real one on
        // disk. Renaming is the belt to the guard's braces: even if someone
        // passes the flag and forgets, the file itself says so.
        applicationVariants.all {
            if (name == "release") {
                outputs.all {
                    val output = this as? com.android.build.gradle.internal.api.BaseVariantOutputImpl
                    output?.outputFileName = "app-release-UNSIGNED-DO-NOT-PUBLISH.apk"
                }
            }
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
