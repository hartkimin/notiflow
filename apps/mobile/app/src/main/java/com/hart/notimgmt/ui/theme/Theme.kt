package com.hart.notimgmt.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// ============================================
// TWS iOS Glassmorphism Theme
// ============================================

private val TwsLightColorScheme = lightColorScheme(
    primary = TwsSkyBlue,
    onPrimary = TwsWhite,
    primaryContainer = TwsSkyBlueLight,
    onPrimaryContainer = TwsLightTextPrimary,
    secondary = TwsMint,
    onSecondary = TwsWhite,
    secondaryContainer = TwsMintLight,
    onSecondaryContainer = TwsLightTextPrimary,
    tertiary = TwsMint,
    onTertiary = TwsWhite,
    background = TwsLightBackground,
    onBackground = TwsLightTextPrimary,
    surface = TwsLightSurface,
    onSurface = TwsLightTextPrimary,
    surfaceVariant = TwsLightSurfaceVariant,
    onSurfaceVariant = TwsLightTextSecondary,
    outline = TwsLightBorder,
    outlineVariant = TwsLightBorder,
    error = TwsError,
    onError = TwsWhite,
    errorContainer = TwsErrorLight,
    onErrorContainer = TwsError,
    inverseSurface = TwsDarkSurface,
    inverseOnSurface = TwsDarkTextPrimary,
    surfaceTint = TwsSkyBlue
)

private val TwsDarkColorScheme = darkColorScheme(
    primary = TwsSkyBlueLight,
    onPrimary = TwsDarkBackground,
    primaryContainer = TwsSkyBlue,
    onPrimaryContainer = TwsWhite,
    secondary = TwsMintLight,
    onSecondary = TwsDarkBackground,
    secondaryContainer = TwsMint,
    onSecondaryContainer = TwsWhite,
    tertiary = TwsMintLight,
    onTertiary = TwsDarkBackground,
    background = TwsDarkBackground,
    onBackground = TwsDarkTextPrimary,
    surface = TwsDarkSurface,
    onSurface = TwsDarkTextPrimary,
    surfaceVariant = TwsDarkSurfaceVariant,
    onSurfaceVariant = TwsDarkTextSecondary,
    outline = TwsDarkBorder,
    outlineVariant = TwsDarkBorder,
    error = TwsError,
    onError = TwsWhite,
    errorContainer = TwsDarkSurfaceVariant,
    onErrorContainer = TwsError,
    inverseSurface = TwsLightSurface,
    inverseOnSurface = TwsLightTextPrimary,
    surfaceTint = TwsSkyBlueLight
)

// Glass Colors for Composables
data class GlassColors(
    val surface: Color,
    val surfaceLight: Color,
    val border: Color,
    val shadow: Color,
    val gradientStart: Color,
    val gradientMiddle: Color,
    val gradientEnd: Color
)

val LocalGlassColors = staticCompositionLocalOf {
    GlassColors(
        surface = TwsGlassWhite,
        surfaceLight = TwsGlassWhiteLight,
        border = TwsGlassBorderLight,
        shadow = TwsShadowLight,
        gradientStart = TwsGradientStart,
        gradientMiddle = TwsGradientMiddle,
        gradientEnd = TwsGradientEnd
    )
}

@Composable
fun NotiFlowTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) TwsDarkColorScheme else TwsLightColorScheme

    val glassColors = if (darkTheme) {
        GlassColors(
            surface = TwsGlassDark,
            surfaceLight = TwsGlassDarkLight,
            border = TwsGlassBorderDark,
            shadow = TwsShadowDark,
            gradientStart = TwsSkyBlueDark,
            gradientMiddle = TwsMint,
            gradientEnd = TwsSkyBlue
        )
    } else {
        GlassColors(
            surface = TwsGlassWhite,
            surfaceLight = TwsGlassWhiteLight,
            border = TwsGlassBorderLight,
            shadow = TwsShadowLight,
            gradientStart = TwsGradientStart,
            gradientMiddle = TwsGradientMiddle,
            gradientEnd = TwsGradientEnd
        )
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Make status bar transparent for glassmorphism effect
            window.statusBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    CompositionLocalProvider(LocalGlassColors provides glassColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            content = content
        )
    }
}

// Extension to access glass colors
object TwsTheme {
    val glassColors: GlassColors
        @Composable
        get() = LocalGlassColors.current
}
