package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.auth.AuthManager
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.sync.SyncManager
import com.hart.notimgmt.data.sync.SyncState
import com.hart.notimgmt.data.sync.SyncStatus
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

    private val _userEmail = MutableStateFlow(authManager.getUserEmail())
    val userEmail: StateFlow<String?> = _userEmail.asStateFlow()

    private val _isLoggedIn = MutableStateFlow(authManager.isLoggedIn)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _isLoggingOut = MutableStateFlow(false)
    val isLoggingOut: StateFlow<Boolean> = _isLoggingOut.asStateFlow()

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
}
