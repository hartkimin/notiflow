package com.hart.notimgmt.data.preferences

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.hart.notimgmt.ai.GemmaModelSize
import com.hart.notimgmt.data.model.AppFilterMode
import com.hart.notimgmt.data.model.AppMode
import com.hart.notimgmt.data.model.ThemeMode
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppPreferences @Inject constructor(
    @ApplicationContext context: Context
) {
    companion object {
        private const val TAG = "AppPreferences"
        private const val ENCRYPTED_PREFS_NAME = "mednoti_credentials"
        // 미분류 메시지를 숨김 처리할 때 사용하는 특별 ID
        const val UNCATEGORIZED_ID = "uncategorized"
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences("mednoti_prefs", Context.MODE_PRIVATE)

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val encryptedPrefs: SharedPreferences = createEncryptedPrefs(context)

    private fun createEncryptedPrefs(context: Context): SharedPreferences {
        return try {
            EncryptedSharedPreferences.create(
                context,
                ENCRYPTED_PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // AEADBadTagException: 앱 재설치 시 Keystore 키는 남아있지만 파일이 삭제되어 복호화 실패
            Log.w(TAG, "EncryptedSharedPreferences corrupted, resetting", e)
            context.deleteSharedPreferences(ENCRYPTED_PREFS_NAME)
            EncryptedSharedPreferences.create(
                context,
                ENCRYPTED_PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }

    // 로그인 정보 저장 여부
    var saveCredentials: Boolean
        get() = prefs.getBoolean("save_credentials", false)
        set(value) {
            prefs.edit().putBoolean("save_credentials", value).apply()
        }

    val savedEmail: String?
        get() = encryptedPrefs.getString("saved_email", null)

    val savedPassword: String?
        get() = encryptedPrefs.getString("saved_password", null)

    fun saveLoginCredentials(email: String, password: String) {
        encryptedPrefs.edit()
            .putString("saved_email", email)
            .putString("saved_password", password)
            .commit()
        saveCredentials = true
    }

    fun clearLoginCredentials() {
        encryptedPrefs.edit()
            .remove("saved_email")
            .remove("saved_password")
            .apply()
        saveCredentials = false
    }

    var appFilterMode: AppFilterMode
        get() {
            val value = prefs.getString("app_filter_mode", AppFilterMode.WHITELIST.name)
            return try {
                AppFilterMode.valueOf(value ?: AppFilterMode.WHITELIST.name)
            } catch (e: Exception) {
                AppFilterMode.WHITELIST
            }
        }
        set(value) {
            prefs.edit().putString("app_filter_mode", value.name).apply()
        }

    var smsCaptureEnabled: Boolean
        get() = prefs.getBoolean("sms_capture_enabled", true)
        set(value) {
            prefs.edit().putBoolean("sms_capture_enabled", value).apply()
        }

    private val _themeModeFlow = MutableStateFlow(themeMode)
    val themeModeFlow: StateFlow<ThemeMode> = _themeModeFlow

    var captureNotificationEnabled: Boolean
        get() = prefs.getBoolean("capture_notification_enabled", true)
        set(value) {
            prefs.edit().putBoolean("capture_notification_enabled", value).apply()
        }

    var categorySortByName: Boolean
        get() = prefs.getBoolean("category_sort_by_name", false)
        set(value) {
            prefs.edit().putBoolean("category_sort_by_name", value).apply()
        }

    var statsCardExpanded: Boolean
        get() = prefs.getBoolean("stats_card_expanded", true)
        set(value) {
            prefs.edit().putBoolean("stats_card_expanded", value).apply()
        }

    var autoDeleteDays: Int
        get() = prefs.getInt("auto_delete_days", 0)
        set(value) {
            prefs.edit().putInt("auto_delete_days", value).apply()
        }

    var isOnboardingCompleted: Boolean
        get() = prefs.getBoolean("onboarding_completed", false)
        set(value) {
            prefs.edit().putBoolean("onboarding_completed", value).apply()
        }

    var isTutorialSeen: Boolean
        get() = prefs.getBoolean("tutorial_seen", false)
        set(value) {
            prefs.edit().putBoolean("tutorial_seen", value).apply()
        }

    // App mode (OFFLINE or CLOUD) — defaults to OFFLINE for login-free first launch
    var appMode: AppMode
        get() {
            val value = prefs.getString("app_mode", AppMode.OFFLINE.name)
            return try {
                AppMode.valueOf(value ?: AppMode.OFFLINE.name)
            } catch (e: Exception) {
                AppMode.OFFLINE
            }
        }
        set(value) {
            prefs.edit().putString("app_mode", value.name).commit()
        }

    val isCloudMode: Boolean
        get() = appMode == AppMode.CLOUD

    // Whether user has selected a mode (existing users default to true)
    var isModeSelected: Boolean
        get() = prefs.getBoolean("mode_selected", true)
        set(value) {
            prefs.edit().putBoolean("mode_selected", value).commit()
        }

    var themeMode: ThemeMode
        get() {
            val value = prefs.getString("theme_mode", ThemeMode.LIGHT.name)
            return try {
                ThemeMode.valueOf(value ?: ThemeMode.LIGHT.name)
            } catch (e: Exception) {
                ThemeMode.LIGHT
            }
        }
        set(value) {
            prefs.edit().putString("theme_mode", value.name).apply()
            _themeModeFlow.value = value
        }

    // 숨김 카테고리 (UNCATEGORIZED_ID = 미분류)
    private val _hiddenCategoryIdsFlow = MutableStateFlow(hiddenCategoryIds)
    val hiddenCategoryIdsFlow: StateFlow<Set<String>> = _hiddenCategoryIdsFlow

    var hiddenCategoryIds: Set<String>
        get() = prefs.getStringSet("hidden_category_ids_v2", emptySet()) ?: emptySet()
        set(value) {
            prefs.edit().putStringSet("hidden_category_ids_v2", value).apply()
            _hiddenCategoryIdsFlow.value = value
        }

    fun toggleCategoryVisibility(categoryId: String) {
        val current = hiddenCategoryIds.toMutableSet()
        if (current.contains(categoryId)) {
            current.remove(categoryId)
        } else {
            current.add(categoryId)
        }
        hiddenCategoryIds = current
    }

    fun isCategoryHidden(categoryId: String): Boolean {
        return hiddenCategoryIds.contains(categoryId)
    }

    // AI settings
    var aiPromptPresets: String
        get() = prefs.getString("ai_prompt_presets", "[]") ?: "[]"
        set(value) { prefs.edit().putString("ai_prompt_presets", value).apply() }

    var aiSelectedPresetId: String
        get() = prefs.getString("ai_selected_preset_id", "") ?: ""
        set(value) { prefs.edit().putString("ai_selected_preset_id", value).apply() }

    var aiModelSize: GemmaModelSize
        get() {
            val value = prefs.getString("ai_model_size", GemmaModelSize.E2B.name)
            return try {
                GemmaModelSize.valueOf(value ?: GemmaModelSize.E2B.name)
            } catch (e: Exception) {
                GemmaModelSize.E2B
            }
        }
        set(value) {
            prefs.edit().putString("ai_model_size", value.name).apply()
        }

    // Last cloud sync time (epoch millis)
    var lastSyncAt: Long
        get() = prefs.getLong("last_sync_at", 0L)
        set(value) {
            prefs.edit().putLong("last_sync_at", value).apply()
        }

    // Supabase URL (runtime-configurable, defaults to BuildConfig)
    var supabaseUrl: String
        get() = prefs.getString("supabase_url", com.hart.notimgmt.BuildConfig.SUPABASE_URL) ?: com.hart.notimgmt.BuildConfig.SUPABASE_URL
        set(value) {
            prefs.edit().putString("supabase_url", value).commit()
        }

    // Supabase Key (runtime-configurable, defaults to BuildConfig)
    var supabaseKey: String
        get() = prefs.getString("supabase_key", com.hart.notimgmt.BuildConfig.SUPABASE_KEY) ?: com.hart.notimgmt.BuildConfig.SUPABASE_KEY
        set(value) {
            prefs.edit().putString("supabase_key", value).commit()
        }

    // FCM token
    var fcmToken: String?
        get() = prefs.getString("fcm_token", null)
        set(value) {
            prefs.edit().putString("fcm_token", value).apply()
        }

    // NotiRoute API Gateway settings
    private val _notiFlowEnabledFlow = MutableStateFlow(notiFlowEnabled)
    val notiFlowEnabledFlow: StateFlow<Boolean> = _notiFlowEnabledFlow

    var notiFlowEnabled: Boolean
        get() = prefs.getBoolean("notiroute_enabled", true)
        set(value) {
            prefs.edit().putBoolean("notiroute_enabled", value).apply()
            _notiFlowEnabledFlow.value = value
        }

    var notiFlowApiUrl: String
        get() = prefs.getString("notiroute_api_url", "https://notiroute.life") ?: "https://notiroute.life"
        set(value) {
            prefs.edit().putString("notiroute_api_url", value).apply()
        }

    var notiFlowApiKey: String
        get() = encryptedPrefs.getString("notiroute_api_key", "wkdgns2!@#") ?: ""
        set(value) {
            encryptedPrefs.edit().putString("notiroute_api_key", value).apply()
        }

    // HuggingFace OAuth token storage (encrypted)
    fun saveHfTokenData(accessToken: String, refreshToken: String, expiresAt: Long) {
        encryptedPrefs.edit()
            .putString("hf_access_token", accessToken)
            .putString("hf_refresh_token", refreshToken)
            .putLong("hf_token_expires_at", expiresAt)
            .apply()
    }

    fun clearHfTokenData() {
        encryptedPrefs.edit()
            .remove("hf_access_token")
            .remove("hf_refresh_token")
            .remove("hf_token_expires_at")
            // Also remove legacy manual token if exists
            .remove("hf_token")
            .apply()
    }

    fun readHfAccessToken(): String? {
        return if (isHfTokenValid()) {
            encryptedPrefs.getString("hf_access_token", null)
        } else null
    }

    fun readHfRefreshToken(): String? {
        return encryptedPrefs.getString("hf_refresh_token", null)
    }

    fun getHfTokenExpiresAt(): Long {
        return encryptedPrefs.getLong("hf_token_expires_at", 0L)
    }

    /** Token is valid if it exists and hasn't expired (5-minute buffer). */
    fun isHfTokenValid(): Boolean {
        val accessToken = encryptedPrefs.getString("hf_access_token", null)
        if (accessToken.isNullOrBlank()) return false
        val expiresAt = encryptedPrefs.getLong("hf_token_expires_at", 0L)
        val now = System.currentTimeMillis()
        // 5-minute buffer (300_000 ms)
        return now < (expiresAt - 300_000L)
    }

    fun hasHfToken(): Boolean {
        return !encryptedPrefs.getString("hf_access_token", null).isNullOrBlank()
    }
}

