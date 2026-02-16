package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.backup.BackupManager
import com.hart.notimgmt.data.db.entity.AppFilterEntity
import com.hart.notimgmt.data.model.AppFilterMode
import com.hart.notimgmt.data.model.ThemeMode
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.repository.AppFilterRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class InstalledApp(
    val packageName: String,
    val appName: String,
    val isSelected: Boolean
)

@HiltViewModel
class AppFilterViewModel @Inject constructor(
    private val appFilterRepository: AppFilterRepository,
    private val appPreferences: AppPreferences,
    val backupManager: BackupManager
) : ViewModel() {

    val appFilters = appFilterRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _filterMode = MutableStateFlow(appPreferences.appFilterMode)
    val filterMode: StateFlow<AppFilterMode> = _filterMode

    private val _smsCaptureEnabled = MutableStateFlow(appPreferences.smsCaptureEnabled)
    val smsCaptureEnabled: StateFlow<Boolean> = _smsCaptureEnabled

    private val _themeMode = MutableStateFlow(appPreferences.themeMode)
    val themeMode: StateFlow<ThemeMode> = _themeMode

    private val _captureNotificationEnabled = MutableStateFlow(appPreferences.captureNotificationEnabled)
    val captureNotificationEnabled: StateFlow<Boolean> = _captureNotificationEnabled

    private val _autoDeleteDays = MutableStateFlow(appPreferences.autoDeleteDays)
    val autoDeleteDays: StateFlow<Int> = _autoDeleteDays

    fun setFilterMode(mode: AppFilterMode) {
        appPreferences.appFilterMode = mode
        _filterMode.value = mode
    }

    fun setSmsCaptureEnabled(enabled: Boolean) {
        appPreferences.smsCaptureEnabled = enabled
        _smsCaptureEnabled.value = enabled
    }

    fun setThemeMode(mode: ThemeMode) {
        appPreferences.themeMode = mode
        _themeMode.value = mode
    }

    fun setCaptureNotificationEnabled(enabled: Boolean) {
        appPreferences.captureNotificationEnabled = enabled
        _captureNotificationEnabled.value = enabled
    }

    fun setAutoDeleteDays(days: Int) {
        appPreferences.autoDeleteDays = days
        _autoDeleteDays.value = days
    }

    fun toggleAppFilter(packageName: String, appName: String, isAllowed: Boolean) {
        viewModelScope.launch {
            appFilterRepository.upsert(
                AppFilterEntity(
                    packageName = packageName,
                    appName = appName,
                    isAllowed = isAllowed
                )
            )
        }
    }

    fun removeAppFilter(packageName: String) {
        viewModelScope.launch {
            val filter = appFilterRepository.getByPackageName(packageName) ?: return@launch
            appFilterRepository.delete(filter)
        }
    }

    fun saveSelectedApps(apps: List<InstalledApp>) {
        viewModelScope.launch {
            val filters = apps.filter { it.isSelected }.map { app ->
                AppFilterEntity(
                    packageName = app.packageName,
                    appName = app.appName,
                    isAllowed = true
                )
            }
            appFilterRepository.replaceAll(filters)
        }
    }
}
