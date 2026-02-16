package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.auth.AuthManager
import com.hart.notimgmt.data.notiflow.NotiFlowApiClient
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.sync.SyncManager
import com.hart.notimgmt.data.sync.SyncState
import com.hart.notimgmt.data.sync.SyncStatus
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authManager: AuthManager,
    private val syncManager: SyncManager,
    private val appPreferences: AppPreferences,
    private val notiFlowApiClient: NotiFlowApiClient
) : ViewModel() {

    val syncStatus: StateFlow<SyncStatus> = syncManager.syncStatus
    val syncState: StateFlow<SyncState> = syncManager.syncState

    private val _userEmail = MutableStateFlow(authManager.getUserEmail())
    val userEmail: StateFlow<String?> = _userEmail.asStateFlow()

    private val _isLoggedIn = MutableStateFlow(authManager.isLoggedIn)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _isLoggingOut = MutableStateFlow(false)
    val isLoggingOut: StateFlow<Boolean> = _isLoggingOut.asStateFlow()

    // NotiFlow API settings
    val notiFlowEnabled: StateFlow<Boolean> = appPreferences.notiFlowEnabledFlow

    private val _notiFlowApiUrl = MutableStateFlow(appPreferences.notiFlowApiUrl)
    val notiFlowApiUrl: StateFlow<String> = _notiFlowApiUrl.asStateFlow()

    private val _notiFlowApiKey = MutableStateFlow(appPreferences.notiFlowApiKey)
    val notiFlowApiKey: StateFlow<String> = _notiFlowApiKey.asStateFlow()

    private val _notiFlowTestResult = MutableStateFlow<Pair<Boolean, String>?>(null)
    val notiFlowTestResult: StateFlow<Pair<Boolean, String>?> = _notiFlowTestResult.asStateFlow()

    private val _notiFlowTesting = MutableStateFlow(false)
    val notiFlowTesting: StateFlow<Boolean> = _notiFlowTesting.asStateFlow()

    init {
        viewModelScope.launch {
            authManager.observeAuthState().collect { user ->
                _userEmail.value = user?.email
                _isLoggedIn.value = user != null
            }
        }
    }

    fun triggerManualSync() {
        syncManager.forceSync()
    }

    fun logout(onLogoutComplete: () -> Unit) {
        viewModelScope.launch {
            _isLoggingOut.value = true
            try {
                authManager.signOut()
                onLogoutComplete()
            } finally {
                _isLoggingOut.value = false
            }
        }
    }

    // NotiFlow settings
    fun setNotiFlowEnabled(enabled: Boolean) {
        appPreferences.notiFlowEnabled = enabled
    }

    fun setNotiFlowApiUrl(url: String) {
        appPreferences.notiFlowApiUrl = url
        _notiFlowApiUrl.value = url
    }

    fun setNotiFlowApiKey(key: String) {
        appPreferences.notiFlowApiKey = key
        _notiFlowApiKey.value = key
    }

    fun testNotiFlowConnection() {
        viewModelScope.launch(Dispatchers.IO) {
            _notiFlowTesting.value = true
            _notiFlowTestResult.value = null
            val result = notiFlowApiClient.testConnection()
            _notiFlowTestResult.value = result
            _notiFlowTesting.value = false
        }
    }
}
