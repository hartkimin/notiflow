package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.auth.AuthManager
import com.hart.notimgmt.data.model.AppMode
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.sync.SyncManager
import com.hart.notimgmt.data.sync.SyncState
import com.hart.notimgmt.data.sync.SyncStatus
import com.hart.notimgmt.data.backup.DataSummary
import com.hart.notimgmt.data.sync.DownloadOptions
import com.hart.notimgmt.data.sync.UploadOptions
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authManager: AuthManager,
    private val syncManager: SyncManager,
    private val appPreferences: AppPreferences
) : ViewModel() {

    val syncStatus: StateFlow<SyncStatus> = syncManager.syncStatus
    val syncState: StateFlow<SyncState> = syncManager.syncState
    val restoreAvailable = syncManager.restoreAvailable
    val isRestoring = syncManager.isRestoring

    private val _userEmail = MutableStateFlow(authManager.getUserEmail())
    val userEmail: StateFlow<String?> = _userEmail.asStateFlow()

    private val _isLoggedIn = MutableStateFlow(authManager.isLoggedIn)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _isLoggingOut = MutableStateFlow(false)
    val isLoggingOut: StateFlow<Boolean> = _isLoggingOut.asStateFlow()

    private val _appMode = MutableStateFlow(appPreferences.appMode)
    val appMode: StateFlow<AppMode> = _appMode.asStateFlow()

    private val _supabaseUrl = MutableStateFlow(appPreferences.supabaseUrl)
    val supabaseUrl: StateFlow<String> = _supabaseUrl.asStateFlow()

    init {
        viewModelScope.launch {
            authManager.observeAuthState().collect { user ->
                _userEmail.value = user?.email
                _isLoggedIn.value = user != null
            }
        }
    }

    fun clearSyncError() {
        syncManager.clearErrorIfStale()
    }

    fun triggerManualSync() {
        syncManager.forceSync()
    }

    fun triggerUploadSync(options: UploadOptions = UploadOptions()) {
        syncManager.forceUpload(options)
    }

    fun triggerDownloadSync(options: DownloadOptions = DownloadOptions(), cleanRestore: Boolean = false) {
        syncManager.forceDownload(options, cleanRestore = cleanRestore)
    }

    /**
     * 재설치 후 서버에서 전체 설정 복원
     */
    fun restoreFromServer() {
        syncManager.dismissRestorePrompt()
        syncManager.forceDownload(cleanRestore = true)
    }

    /**
     * 복원 제안 무시 (새로 시작)
     */
    fun dismissRestore() {
        syncManager.dismissRestorePrompt()
        syncManager.forceSync()  // 빈 로컬 → 서버 업로드 (빈 데이터)
    }

    suspend fun getRemoteDataSummary(): DataSummary {
        return syncManager.getRemoteDataSummary()
    }

    /**
     * 서버 연결 상태 확인 (로그인 플로우에서 사용)
     */
    suspend fun checkServerHealth(): String? {
        return syncManager.checkServerHealth()
    }

    fun logout(onLogoutComplete: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoggingOut.value = true
            try {
                authManager.signOut()
                appPreferences.appMode = AppMode.OFFLINE
                _appMode.value = AppMode.OFFLINE
                onLogoutComplete()
            } finally {
                _isLoggingOut.value = false
            }
        }
    }

    fun switchToOffline(onComplete: () -> Unit) {
        viewModelScope.launch {
            _isLoggingOut.value = true
            try {
                authManager.signOut()
                appPreferences.appMode = AppMode.OFFLINE
                _appMode.value = AppMode.OFFLINE
                onComplete()
            } finally {
                _isLoggingOut.value = false
            }
        }
    }

    private val _isLoggingIn = MutableStateFlow(false)
    val isLoggingIn: StateFlow<Boolean> = _isLoggingIn.asStateFlow()

    private val _loginError = MutableStateFlow<String?>(null)
    val loginError: StateFlow<String?> = _loginError.asStateFlow()

    fun login(email: String, password: String, serverUrl: String? = null, onSuccess: () -> Unit = {}, onRestartRequired: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoggingIn.value = true
            _loginError.value = null
            try {
                val urlToUse = serverUrl?.ifBlank { null }
                val urlChanged = urlToUse != null && urlToUse != appPreferences.supabaseUrl

                if (urlChanged) {
                    // URL 변경 시 저장 후 앱 재시작 필요
                    appPreferences.supabaseUrl = urlToUse!!
                    appPreferences.appMode = AppMode.CLOUD
                    _appMode.value = AppMode.CLOUD
                    onRestartRequired()
                    return@launch
                }

                val result = authManager.signInWithEmail(email, password)
                result.fold(
                    onSuccess = {
                        appPreferences.appMode = AppMode.CLOUD
                        _appMode.value = AppMode.CLOUD
                        onSuccess()
                    },
                    onFailure = { e ->
                        _loginError.value = e.message ?: "로그인에 실패했습니다"
                    }
                )
            } catch (e: Exception) {
                _loginError.value = e.message ?: "로그인에 실패했습니다"
            } finally {
                _isLoggingIn.value = false
            }
        }
    }

    fun clearLoginError() {
        _loginError.value = null
    }

    fun getAppPreferences(): AppPreferences = appPreferences

    fun saveLoginCredentials(email: String, password: String) {
        appPreferences.saveLoginCredentials(email, password)
    }

    fun clearLoginCredentials() {
        appPreferences.clearLoginCredentials()
    }
}
