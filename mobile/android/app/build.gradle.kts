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
            // a Cafe Bazaar/Myket upload); falls back to the debug keystore otherwise so
            // `flutter run --release`/`flutter build apk --release` still work on a dev
            // machine or in CI without one. Once a real keystore exists, every future
            // release build MUST use the same key.properties — Android/the stores reject
            // an update signed with a different key than the original upload.
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

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
