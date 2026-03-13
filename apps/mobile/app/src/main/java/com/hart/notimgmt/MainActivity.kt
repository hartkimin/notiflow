package com.hart.notimgmt

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.hart.notimgmt.data.auth.AuthManager
import com.hart.notimgmt.data.model.ThemeMode
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.ui.navigation.AppNavigation
import com.hart.notimgmt.ui.theme.NotiRouteTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var appPreferences: AppPreferences

    @Inject
    lateinit var authManager: AuthManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val themeMode by appPreferences.themeModeFlow.collectAsState()
            val darkTheme = when (themeMode) {
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
            }
            NotiRouteTheme(darkTheme = darkTheme) {
                AppNavigation(
                    appPreferences = appPreferences,
                    authManager = authManager
                )
            }
        }
    }
}

