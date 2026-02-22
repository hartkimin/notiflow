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
// NotiFlow Indigo Glassmorphism Theme
// ============================================

private val NotiFlowLightColorScheme = lightColorScheme(
    primary = NotiFlowIndigo,
    onPrimary = NotiFlowWhite,
    primaryContainer = NotiFlowIndigoLight,
    onPrimaryContainer = NotiFlowLightTextPrimary,
    secondary = NotiFlowViolet,
    onSecondary = NotiFlowWhite,
    secondaryContainer = NotiFlowVioletLight,
    onSecondaryContainer = NotiFlowLightTextPrimary,
    tertiary = NotiFlowViolet,
    onTertiary = NotiFlowWhite,
    background = NotiFlowLightBackground,
    onBackground = NotiFlowLightTextPrimary,
    surface = NotiFlowLightSurface,
    onSurface = NotiFlowLightTextPrimary,
    surfaceVariant = NotiFlowLightSurfaceVariant,
    onSurfaceVariant = NotiFlowLightTextSecondary,
    outline = NotiFlowLightBorder,
    outlineVariant = NotiFlowLightBorder,
    error = NotiFlowError,
    onError = NotiFlowWhite,
    errorContainer = NotiFlowErrorLight,
    onErrorContainer = NotiFlowError,
    inverseSurface = NotiFlowDarkSurface,
    inverseOnSurface = NotiFlowDarkTextPrimary,
    surfaceTint = NotiFlowIndigo
)

private val NotiFlowDarkColorScheme = darkColorScheme(
    primary = NotiFlowIndigoLight,
    onPrimary = NotiFlowDarkBackground,
    primaryContainer = NotiFlowIndigo,
    onPrimaryContainer = NotiFlowWhite,
    secondary = NotiFlowVioletLight,
    onSecondary = NotiFlowDarkBackground,
    secondaryContainer = NotiFlowViolet,
    onSecondaryContainer = NotiFlowWhite,
    tertiary = NotiFlowVioletLight,
    onTertiary = NotiFlowDarkBackground,
    background = NotiFlowDarkBackground,
    onBackground = NotiFlowDarkTextPrimary,
    surface = NotiFlowDarkSurface,
    onSurface = NotiFlowDarkTextPrimary,
    surfaceVariant = NotiFlowDarkSurfaceVariant,
    onSurfaceVariant = NotiFlowDarkTextSecondary,
    outline = NotiFlowDarkBorder,
    outlineVariant = NotiFlowDarkBorder,
    error = NotiFlowError,
    onError = NotiFlowWhite,
    errorContainer = NotiFlowDarkSurfaceVariant,
    onErrorContainer = NotiFlowError,
    inverseSurface = NotiFlowLightSurface,
    inverseOnSurface = NotiFlowLightTextPrimary,
    surfaceTint = NotiFlowIndigoLight
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
        surface = NotiFlowGlassWhite,
        surfaceLight = NotiFlowGlassWhiteLight,
        border = NotiFlowGlassBorderLight,
        shadow = NotiFlowShadowLight,
        gradientStart = NotiFlowGradientStart,
        gradientMiddle = NotiFlowGradientMiddle,
        gradientEnd = NotiFlowGradientEnd
    )
}

@Composable
fun NotiFlowTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) NotiFlowDarkColorScheme else NotiFlowLightColorScheme

    val glassColors = if (darkTheme) {
        GlassColors(
            surface = NotiFlowGlassDark,
            surfaceLight = NotiFlowGlassDarkLight,
            border = NotiFlowGlassBorderDark,
            shadow = NotiFlowShadowDark,
            gradientStart = NotiFlowIndigoDark,
            gradientMiddle = NotiFlowViolet,
            gradientEnd = NotiFlowIndigo
        )
    } else {
        GlassColors(
            surface = NotiFlowGlassWhite,
            surfaceLight = NotiFlowGlassWhiteLight,
            border = NotiFlowGlassBorderLight,
            shadow = NotiFlowShadowLight,
            gradientStart = NotiFlowGradientStart,
            gradientMiddle = NotiFlowGradientMiddle,
            gradientEnd = NotiFlowGradientEnd
        )
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            @Suppress("DEPRECATION")
            window.statusBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    CompositionLocalProvider(LocalGlassColors provides glassColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = NotiFlowTypography,
            content = content
        )
    }
}

// Extension to access glass colors
object NotiFlowDesign {
    val glassColors: GlassColors
        @Composable
        get() = LocalGlassColors.current
}
