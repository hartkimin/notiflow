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
// NotiRoute Indigo Glassmorphism Theme
// ============================================

private val NotiRouteLightOnPrimary = Color(0xFF000000) // black text on pink — WCAG AA 7:1

private val NotiRouteLightColorScheme = lightColorScheme(
    primary = NotiRouteIndigo,
    onPrimary = NotiRouteLightOnPrimary,
    primaryContainer = NotiRouteIndigoLight,
    onPrimaryContainer = NotiRouteLightTextPrimary,
    secondary = NotiRouteViolet,
    onSecondary = NotiRouteLightOnPrimary,
    secondaryContainer = NotiRouteVioletLight,
    onSecondaryContainer = NotiRouteLightTextPrimary,
    tertiary = NotiRouteViolet,
    onTertiary = NotiRouteLightOnPrimary,
    background = NotiRouteLightBackground,
    onBackground = NotiRouteLightTextPrimary,
    surface = NotiRouteLightSurface,
    onSurface = NotiRouteLightTextPrimary,
    surfaceVariant = NotiRouteLightSurfaceVariant,
    onSurfaceVariant = NotiRouteLightTextSecondary,
    outline = NotiRouteLightBorder,
    outlineVariant = NotiRouteLightBorder,
    error = NotiRouteError,
    onError = NotiRouteWhite,
    errorContainer = NotiRouteErrorLight,
    onErrorContainer = NotiRouteError,
    inverseSurface = NotiRouteDarkSurface,
    inverseOnSurface = NotiRouteDarkTextPrimary,
    surfaceTint = NotiRouteIndigo
)

private val NotiRouteDarkColorScheme = darkColorScheme(
    primary = NotiRouteIndigoLight,
    onPrimary = NotiRouteDarkBackground,
    primaryContainer = NotiRouteIndigo,
    onPrimaryContainer = NotiRouteWhite,
    secondary = NotiRouteVioletLight,
    onSecondary = NotiRouteDarkBackground,
    secondaryContainer = NotiRouteViolet,
    onSecondaryContainer = NotiRouteWhite,
    tertiary = NotiRouteVioletLight,
    onTertiary = NotiRouteDarkBackground,
    background = NotiRouteDarkBackground,
    onBackground = NotiRouteDarkTextPrimary,
    surface = NotiRouteDarkSurface,
    onSurface = NotiRouteDarkTextPrimary,
    surfaceVariant = NotiRouteDarkSurfaceVariant,
    onSurfaceVariant = NotiRouteDarkTextSecondary,
    outline = NotiRouteDarkBorder,
    outlineVariant = NotiRouteDarkBorder,
    error = NotiRouteError,
    onError = NotiRouteWhite,
    errorContainer = NotiRouteDarkSurfaceVariant,
    onErrorContainer = NotiRouteError,
    inverseSurface = NotiRouteLightSurface,
    inverseOnSurface = NotiRouteLightTextPrimary,
    surfaceTint = NotiRouteIndigoLight
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

/** App-level dark theme flag — respects ThemeMode override, not just system setting. */
val LocalIsDarkTheme = staticCompositionLocalOf { false }

val LocalGlassColors = staticCompositionLocalOf {
    GlassColors(
        surface = NotiRouteGlassWhite,
        surfaceLight = NotiRouteGlassWhiteLight,
        border = NotiRouteGlassBorderLight,
        shadow = NotiRouteShadowLight,
        gradientStart = NotiRouteGradientStart,
        gradientMiddle = NotiRouteGradientMiddle,
        gradientEnd = NotiRouteGradientEnd
    )
}

@Composable
fun NotiRouteTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) NotiRouteDarkColorScheme else NotiRouteLightColorScheme

    val glassColors = if (darkTheme) {
        GlassColors(
            surface = NotiRouteGlassDark,
            surfaceLight = NotiRouteGlassDarkLight,
            border = NotiRouteGlassBorderDark,
            shadow = NotiRouteShadowDark,
            gradientStart = NotiRouteIndigoDark,
            gradientMiddle = NotiRouteViolet,
            gradientEnd = NotiRouteIndigo
        )
    } else {
        GlassColors(
            surface = NotiRouteGlassWhite,
            surfaceLight = NotiRouteGlassWhiteLight,
            border = NotiRouteGlassBorderLight,
            shadow = NotiRouteShadowLight,
            gradientStart = NotiRouteGradientStart,
            gradientMiddle = NotiRouteGradientMiddle,
            gradientEnd = NotiRouteGradientEnd
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

    CompositionLocalProvider(
        LocalIsDarkTheme provides darkTheme,
        LocalGlassColors provides glassColors
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = NotiRouteTypography,
            content = content
        )
    }
}

// Extension to access glass colors
object NotiRouteDesign {
    val glassColors: GlassColors
        @Composable
        get() = LocalGlassColors.current
}
