plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.ksp)
    alias(libs.plugins.kotlin.compose)
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

android {
    namespace = "com.hart.notimgmt"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.hart.notiflow"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "3.5.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    // Supabase
    implementation("io.github.jan-tennert.supabase:postgrest-kt:3.1.1")
    implementation("io.github.jan-tennert.supabase:auth-kt:3.1.1")
    implementation("io.github.jan-tennert.supabase:realtime-kt:3.1.1")

    // Ktor client for Supabase (OkHttp supports WebSocket for Realtime)
    implementation("io.ktor:ktor-client-okhttp:3.0.3")

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)

    // Room
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    // Hilt Worker (for @HiltWorker support)
    implementation(libs.androidx.hilt.work)

    // Navigation
    implementation(libs.androidx.navigation.compose)

    // ViewModel Compose
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    // Material Icons Extended
    implementation(libs.androidx.material.icons.extended)

    // Eva Icons (iOS style)
    implementation(libs.compose.icons.eva.icons)

    // MediaPipe LLM Inference + Vision (image input)
    implementation(libs.mediapipe.tasks.genai)
    implementation(libs.mediapipe.tasks.vision)

    // WorkManager (model download)
    implementation(libs.androidx.work.runtime.ktx)

    // Browser (CustomTabs for license agreement)
    implementation(libs.androidx.browser)

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    // Coil for image loading
    implementation("io.coil-kt:coil-compose:2.5.0")

    // Reorderable LazyColumn (drag & drop)
    implementation("sh.calvin.reorderable:reorderable:2.4.0")

    // EncryptedSharedPreferences
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}

apply(plugin = "com.google.gms.google-services")