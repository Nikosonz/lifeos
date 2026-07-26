plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
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

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
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
