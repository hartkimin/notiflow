# NotiFlow Design Unification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the NotiFlow Android app's design system for commercial release — rebrand from TWS Sky Blue to NotiFlow Indigo, apply Pretendard font, remove all hardcoded styles, and ensure every screen follows the design system.

**Architecture:** Theme-First approach. Redefine Color.kt → Theme.kt → Type.kt with new Indigo palette and Pretendard font, then rename all `Tws*` references to `NotiFlow*`, then sweep each screen to remove hardcoded values and align with DESIGN.md spec.

**Tech Stack:** Kotlin, Jetpack Compose, Material 3, Pretendard Variable font

---

## Task 1: Download and add Pretendard font

**Files:**
- Create: `apps/mobile/app/src/main/res/font/pretendard_variable.ttf`

**Step 1: Download Pretendard Variable font**

Download from the official Pretendard release. The Variable TTF file is needed:
```bash
cd /mnt/d/Project/09_NotiFlow/apps/mobile/app/src/main/res
mkdir -p font
curl -L -o font/pretendard_variable.ttf "https://github.com/orioncactus/pretendard/releases/download/v1.3.9/PretendardVariable.ttf"
```

If the download fails or the URL is outdated, manually download from https://github.com/orioncactus/pretendard/releases and place the Variable TTF file at `res/font/pretendard_variable.ttf`.

Note: The file must be lowercase with underscores (Android resource naming convention).

**Step 2: Verify the file exists**

```bash
ls -la apps/mobile/app/src/main/res/font/pretendard_variable.ttf
```

Expected: File exists, size ~10-15MB

**Step 3: Commit**

```bash
git add apps/mobile/app/src/main/res/font/pretendard_variable.ttf
git commit -m "chore: add Pretendard Variable font for NotiFlow branding"
```

---

## Task 2: Rewrite Color.kt with NotiFlow Indigo palette

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/theme/Color.kt` (entire file)

**Step 1: Replace the entire Color.kt**

Replace the full content of Color.kt with the new NotiFlow Indigo palette. Every `Tws*` name becomes `NotiFlow*`, and color hex values change per the design doc.

```kotlin
package com.hart.notimgmt.ui.theme

import androidx.compose.ui.graphics.Color

// ============================================
// NotiFlow Indigo Glassmorphism Theme Colors
// ============================================

// NotiFlow Signature Colors
val NotiFlowIndigo = Color(0xFF6366F1)
val NotiFlowIndigoLight = Color(0xFF818CF8)
val NotiFlowIndigoDark = Color(0xFF4F46E5)
val NotiFlowViolet = Color(0xFF8B5CF6)
val NotiFlowVioletLight = Color(0xFFA78BFA)
val NotiFlowWhite = Color(0xFFFFFFFF)
val NotiFlowCream = Color(0xFFFAFAFE)

// Light Mode Colors
val NotiFlowLightBackground = Color(0xFFFAFAFE)
val NotiFlowLightSurface = Color(0xFFFFFFFF)
val NotiFlowLightSurfaceGlass = Color(0xB3FFFFFF) // 70% white
val NotiFlowLightSurfaceVariant = Color(0xFFF1F0FB)
val NotiFlowLightBorder = Color(0x406366F1) // 25% indigo
val NotiFlowLightTextPrimary = Color(0xFF1E1B4B)
val NotiFlowLightTextSecondary = Color(0xFF6B7280)
val NotiFlowLightTextTertiary = Color(0xFF9CA3AF)

// Dark Mode Colors
val NotiFlowDarkBackground = Color(0xFF0F0D1A)
val NotiFlowDarkSurface = Color(0xFF1C1A2E)
val NotiFlowDarkSurfaceGlass = Color(0x991C1A2E) // 60% dark indigo
val NotiFlowDarkSurfaceVariant = Color(0xFF2D2B42)
val NotiFlowDarkBorder = Color(0x33818CF8) // 20% indigo light
val NotiFlowDarkTextPrimary = Color(0xFFFFFFFF)
val NotiFlowDarkTextSecondary = Color(0xFFA5B4FC)
val NotiFlowDarkTextTertiary = Color(0xFF6B7280)

// Semantic Colors
val NotiFlowError = Color(0xFFE74C3C)
val NotiFlowErrorLight = Color(0xFFFDEDED)
val NotiFlowSuccess = Color(0xFF2ECC71)
val NotiFlowSuccessLight = Color(0xFFE8F8F0)
val NotiFlowWarning = Color(0xFFF39C12)
val NotiFlowWarningLight = Color(0xFFFEF5E7)

// Gradient Colors (Indigo Aurora)
val NotiFlowGradientStart = Color(0xFF818CF8)   // Indigo Light
val NotiFlowGradientMiddle = Color(0xFFA78BFA)  // Violet Light
val NotiFlowGradientEnd = Color(0xFFC4B5FD)     // Soft Lavender

// Glass Effect Colors
val NotiFlowGlassWhite = Color(0xB3FFFFFF) // 70%
val NotiFlowGlassWhiteLight = Color(0x80FFFFFF) // 50%
val NotiFlowGlassDark = Color(0xB31C1A2E) // 70% deep indigo dark
val NotiFlowGlassDarkLight = Color(0x802D2B42) // 50%
val NotiFlowGlassBorderLight = Color(0x66FFFFFF) // 40% white
val NotiFlowGlassBorderDark = Color(0x4D818CF8) // 30% indigo light glow

// Shadow Colors
val NotiFlowShadowLight = Color(0x33818CF8) // 20% indigo light
val NotiFlowShadowDark = Color(0x4D000000) // 30% dark

// Tag/Category Colors (vibrant — unchanged)
val NotiFlowRed = Color(0xFFE74C3C)
val NotiFlowPink = Color(0xFFE91E8C)
val NotiFlowPurple = Color(0xFF9B59B6)
val NotiFlowBlue = Color(0xFF3498DB)
val NotiFlowGreen = Color(0xFF2ECC71)
val NotiFlowYellow = Color(0xFFF1C40F)
val NotiFlowOrange = Color(0xFFE67E22)
val NotiFlowTeal = Color(0xFF1ABC9C)
val NotiFlowGray = Color(0xFF95A5A6)
val NotiFlowCoral = Color(0xFFFF6B6B)

const val DEFAULT_CATEGORY_COLOR = 0xFF6366F1.toInt() // NotiFlow Indigo

// ── Chat Bubble Colors (per-app themes) ──

// KakaoTalk
val NotiFlowChatKakaoBackground = Color(0xFFFFF9C4)
val NotiFlowChatKakaoOnBackground = Color(0xFF3E2723)
val NotiFlowChatKakaoBorder = Color(0xFFFFE082)
val NotiFlowChatKakaoAccent = Color(0xFFFEE500)
val NotiFlowChatKakaoSender = Color(0xFF795548)
val NotiFlowChatKakaoDate = Color(0xFF5D4037)
val NotiFlowChatKakaoTimeline = Color(0xFFFFE082)
val NotiFlowChatKakaoTimelineDot = Color(0xFFFFC107)
val NotiFlowChatKakaoDarkBackground = Color(0xFF3E2723)
val NotiFlowChatKakaoDarkOnBackground = Color(0xFFFFF9C4)
val NotiFlowChatKakaoDarkBorder = Color(0xFF5D4037)
val NotiFlowChatKakaoDarkAccent = Color(0xFFFFC107)
val NotiFlowChatKakaoDarkSender = Color(0xFFFFE082)
val NotiFlowChatKakaoDarkDate = Color(0xFFFFE082)
val NotiFlowChatKakaoDarkTimeline = Color(0xFF5D4037)
val NotiFlowChatKakaoDarkTimelineDot = Color(0xFFFFC107)

// Telegram
val NotiFlowChatTelegramBackground = Color(0xFFE3F2FD)
val NotiFlowChatTelegramOnBackground = Color(0xFF1A237E)
val NotiFlowChatTelegramBorder = Color(0xFFBBDEFB)
val NotiFlowChatTelegramAccent = Color(0xFF2196F3)
val NotiFlowChatTelegramSender = Color(0xFF1565C0)
val NotiFlowChatTelegramDate = Color(0xFF1565C0)
val NotiFlowChatTelegramTimeline = Color(0xFFBBDEFB)
val NotiFlowChatTelegramTimelineDot = Color(0xFF2196F3)
val NotiFlowChatTelegramDarkBackground = Color(0xFF1A237E)
val NotiFlowChatTelegramDarkOnBackground = Color(0xFFE3F2FD)
val NotiFlowChatTelegramDarkBorder = Color(0xFF283593)
val NotiFlowChatTelegramDarkAccent = Color(0xFF64B5F6)
val NotiFlowChatTelegramDarkSender = Color(0xFF90CAF9)
val NotiFlowChatTelegramDarkDate = Color(0xFF90CAF9)
val NotiFlowChatTelegramDarkTimeline = Color(0xFF283593)
val NotiFlowChatTelegramDarkTimelineDot = Color(0xFF64B5F6)

// SMS
val NotiFlowChatSmsBackground = Color(0xFFE8F5E9)
val NotiFlowChatSmsOnBackground = Color(0xFF1B5E20)
val NotiFlowChatSmsBorder = Color(0xFFC8E6C9)
val NotiFlowChatSmsAccent = Color(0xFF4CAF50)
val NotiFlowChatSmsSender = Color(0xFF2E7D32)
val NotiFlowChatSmsDate = Color(0xFF2E7D32)
val NotiFlowChatSmsTimeline = Color(0xFFC8E6C9)
val NotiFlowChatSmsTimelineDot = Color(0xFF4CAF50)
val NotiFlowChatSmsDarkBackground = Color(0xFF1B5E20)
val NotiFlowChatSmsDarkOnBackground = Color(0xFFE8F5E9)
val NotiFlowChatSmsDarkBorder = Color(0xFF2E7D32)
val NotiFlowChatSmsDarkAccent = Color(0xFF66BB6A)
val NotiFlowChatSmsDarkSender = Color(0xFFA5D6A7)
val NotiFlowChatSmsDarkDate = Color(0xFFA5D6A7)
val NotiFlowChatSmsDarkTimeline = Color(0xFF2E7D32)
val NotiFlowChatSmsDarkTimelineDot = Color(0xFF66BB6A)

// WhatsApp
val NotiFlowChatWhatsAppBackground = Color(0xFFDCF8C6)
val NotiFlowChatWhatsAppOnBackground = Color(0xFF1B3A1B)
val NotiFlowChatWhatsAppBorder = Color(0xFFC5E1A5)
val NotiFlowChatWhatsAppAccent = Color(0xFF25D366)
val NotiFlowChatWhatsAppSender = Color(0xFF075E54)
val NotiFlowChatWhatsAppDate = Color(0xFF075E54)
val NotiFlowChatWhatsAppTimeline = Color(0xFFC5E1A5)
val NotiFlowChatWhatsAppTimelineDot = Color(0xFF25D366)
val NotiFlowChatWhatsAppDarkBackground = Color(0xFF054640)
val NotiFlowChatWhatsAppDarkOnBackground = Color(0xFFDCF8C6)
val NotiFlowChatWhatsAppDarkBorder = Color(0xFF075E54)
val NotiFlowChatWhatsAppDarkAccent = Color(0xFF25D366)
val NotiFlowChatWhatsAppDarkSender = Color(0xFF80CBC4)
val NotiFlowChatWhatsAppDarkDate = Color(0xFF80CBC4)
val NotiFlowChatWhatsAppDarkTimeline = Color(0xFF075E54)
val NotiFlowChatWhatsAppDarkTimelineDot = Color(0xFF25D366)

// Default Chat (NotiFlow Indigo theme)
val NotiFlowChatDefaultBackground = Color(0xFFF1F0FB)
val NotiFlowChatDefaultOnBackground = Color(0xFF1E1B4B)
val NotiFlowChatDefaultBorder = Color(0xFFE0DEF7)
val NotiFlowChatDefaultAccent = Color(0xFF6366F1)
val NotiFlowChatDefaultSender = Color(0xFF6366F1)
val NotiFlowChatDefaultDate = Color(0xFF6B7280)
val NotiFlowChatDefaultTimeline = Color(0xFFE0DEF7)
val NotiFlowChatDefaultTimelineDot = Color(0xFF6366F1)
val NotiFlowChatDefaultDarkBackground = Color(0xFF1C1A2E)
val NotiFlowChatDefaultDarkOnBackground = Color(0xFFF1F0FB)
val NotiFlowChatDefaultDarkBorder = Color(0xFF2D2B42)
val NotiFlowChatDefaultDarkAccent = Color(0xFF818CF8)
val NotiFlowChatDefaultDarkSender = Color(0xFF818CF8)
val NotiFlowChatDefaultDarkDate = Color(0xFFA5B4FC)
val NotiFlowChatDefaultDarkTimeline = Color(0xFF2D2B42)
val NotiFlowChatDefaultDarkTimelineDot = Color(0xFF818CF8)
```

**Step 2: Build to check for compile errors**

```bash
cd /mnt/d/Project/09_NotiFlow/apps/mobile && ./gradlew compileDebugKotlin 2>&1 | tail -50
```

Expected: FAIL — many references to old `Tws*` names. This is expected. We fix them in Tasks 3-4.

**Step 3: Commit Color.kt only**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/theme/Color.kt
git commit -m "style: redefine Color.kt with NotiFlow Indigo palette

Replace all Tws* color tokens with NotiFlow* naming.
Move chat bubble colors from AppChatStyle.kt inline to Color.kt.
Change primary from Sky Blue (#5DADE2) to Indigo (#6366F1).
Change secondary from Mint (#48D1CC) to Violet (#8B5CF6)."
```

---

## Task 3: Rewrite Theme.kt with NotiFlow naming

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/theme/Theme.kt` (entire file)

**Step 1: Replace Theme.kt**

Update all `Tws*` references to `NotiFlow*` and rename `TwsTheme` object to `NotiFlowDesign`:

```kotlin
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

// Backward compatibility alias (remove after full migration)
@Deprecated("Use NotiFlowDesign", ReplaceWith("NotiFlowDesign"))
val TwsTheme = NotiFlowDesign
```

**Step 2: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/theme/Theme.kt
git commit -m "style: rewrite Theme.kt with NotiFlow Indigo color scheme

Rename TwsLightColorScheme/TwsDarkColorScheme to NotiFlow*.
Rename TwsTheme object to NotiFlowDesign.
Update all color references to new NotiFlow* tokens.
Add deprecated alias for TwsTheme for incremental migration."
```

---

## Task 4: Rewrite Type.kt with Pretendard font

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/theme/Type.kt`

**Step 1: Replace Type.kt with Pretendard-based typography**

```kotlin
package com.hart.notimgmt.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.hart.notimgmt.R

// ============================================
// NotiFlow Typography — Pretendard
// ============================================

val PretendardFontFamily = FontFamily(
    Font(
        R.font.pretendard_variable,
        variationSettings = FontVariation.Settings(
            FontVariation.weight(FontWeight.Normal.weight)
        )
    )
)

val NotiFlowTypography = Typography(
    // Display — Hero titles
    displayLarge = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp,
        lineHeight = 41.sp,
        letterSpacing = (-0.5).sp
    ),
    displayMedium = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.5).sp
    ),
    displaySmall = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 30.sp,
        letterSpacing = (-0.25).sp
    ),

    // Headline — Screen titles
    headlineLarge = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 30.sp,
        letterSpacing = (-0.25).sp
    ),
    headlineMedium = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 26.sp,
        letterSpacing = (-0.15).sp
    ),
    headlineSmall = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 24.sp,
        letterSpacing = (-0.15).sp
    ),

    // Title — Section headers
    titleLarge = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 24.sp,
        letterSpacing = (-0.15).sp
    ),
    titleMedium = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        letterSpacing = (-0.1).sp
    ),
    titleSmall = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.sp
    ),

    // Body — Content text
    bodyLarge = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.sp
    ),
    bodySmall = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.sp
    ),

    // Label — Buttons, captions
    labelLarge = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.sp
    ),
    labelMedium = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.sp
    ),
    labelSmall = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.sp
    )
)

// Keep old name as alias for compilation during migration
@Deprecated("Use NotiFlowTypography", ReplaceWith("NotiFlowTypography"))
val Typography = NotiFlowTypography
```

Note: The `Typography` alias at the bottom ensures Theme.kt compiles even if it still references `Typography`. The Theme.kt from Task 3 already references `NotiFlowTypography`.

**Step 2: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/theme/Type.kt
git commit -m "style: apply Pretendard Variable font to NotiFlow typography

Replace FontFamily.Default with PretendardFontFamily.
Rename Typography to NotiFlowTypography.
All font sizes/weights unchanged — only font family changes."
```

---

## Task 5: Rename TwsTheme → NotiFlowDesign across all UI files

**Files to modify (all imports and usages):**
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/navigation/AppNavigation.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/components/NotiFlowHeader.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/components/GlassComponents.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/components/TwsBackground.kt` → rename file to `NotiFlowBackground.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/settings/SettingsScreen.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/filter/FilterScreen.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/filter/CategoryEditDialog.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/kanban/KanbanScreen.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/kanban/WeeklyPlannerScreen.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/message/MessageCard.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/chat/AiChatScreen.kt`
- `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/onboarding/OnboardingScreen.kt`

**Step 1: Find-and-replace across all files**

In each file listed above, make these replacements:
1. `import com.hart.notimgmt.ui.theme.TwsTheme` → `import com.hart.notimgmt.ui.theme.NotiFlowDesign`
2. `TwsTheme.glassColors` → `NotiFlowDesign.glassColors`
3. `TwsTheme.` → `NotiFlowDesign.` (any other reference)

For `TwsBackground.kt`:
1. Rename file to `NotiFlowBackground.kt`
2. Rename all `TwsBackground` composable functions inside to `NotiFlowBackground`
3. Update any files that import `TwsBackground`

**Step 2: Remove the deprecated TwsTheme alias from Theme.kt**

Delete this block from Theme.kt:
```kotlin
// Backward compatibility alias (remove after full migration)
@Deprecated("Use NotiFlowDesign", ReplaceWith("NotiFlowDesign"))
val TwsTheme = NotiFlowDesign
```

**Step 3: Build to verify**

```bash
cd /mnt/d/Project/09_NotiFlow/apps/mobile && ./gradlew compileDebugKotlin 2>&1 | tail -50
```

Expected: Compilation success (or remaining errors from Tws* color references which should already be fixed by Task 2).

**Step 4: Commit**

```bash
git add -A apps/mobile/app/src/main/java/com/hart/notimgmt/ui/
git commit -m "refactor: rename TwsTheme to NotiFlowDesign across all UI files

Replace all TwsTheme.glassColors with NotiFlowDesign.glassColors.
Rename TwsBackground.kt to NotiFlowBackground.kt.
Remove deprecated TwsTheme alias."
```

---

## Task 6: Rewrite AppChatStyle.kt to use Color.kt tokens

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/chat/AppChatStyle.kt`

**Step 1: Replace AppChatStyle.kt to reference Color.kt tokens**

Replace all inline `Color(0xFF...)` with the `NotiFlowChat*` constants added in Task 2. Also fix 4dp corners to 8dp minimum:

```kotlin
package com.hart.notimgmt.ui.chat

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.ui.theme.*

data class AppChatStyle(
    val bubbleBackground: Color,
    val bubbleOnBackground: Color,
    val bubbleBorderColor: Color,
    val bubbleShape: RoundedCornerShape,
    val accentColor: Color,
    val senderNameColor: Color,
    val dateHeaderColor: Color,
    val timelineLineColor: Color,
    val timelineDotColor: Color
) {
    companion object {
        fun fromSource(source: String, isDark: Boolean): AppChatStyle = when {
            source.contains("kakao", ignoreCase = true) -> if (isDark) kakaoTalkDark else kakaoTalkLight
            source.contains("telegram", ignoreCase = true) -> if (isDark) telegramDark else telegramLight
            source.contains("sms", ignoreCase = true) ||
            source.contains("messaging", ignoreCase = true) ||
            source.contains("com.google.android.apps.messaging", ignoreCase = true) ||
            source.contains("com.samsung.android.messaging", ignoreCase = true) -> if (isDark) smsDark else smsLight
            source.contains("whatsapp", ignoreCase = true) -> if (isDark) whatsAppDark else whatsAppLight
            else -> if (isDark) defaultDark else defaultLight
        }

        // ── KakaoTalk ── (min corner 8dp)
        private val kakaoTalkLight = AppChatStyle(
            bubbleBackground = NotiFlowChatKakaoBackground,
            bubbleOnBackground = NotiFlowChatKakaoOnBackground,
            bubbleBorderColor = NotiFlowChatKakaoBorder,
            bubbleShape = RoundedCornerShape(topStart = 8.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = NotiFlowChatKakaoAccent,
            senderNameColor = NotiFlowChatKakaoSender,
            dateHeaderColor = NotiFlowChatKakaoDate,
            timelineLineColor = NotiFlowChatKakaoTimeline,
            timelineDotColor = NotiFlowChatKakaoTimelineDot
        )
        private val kakaoTalkDark = AppChatStyle(
            bubbleBackground = NotiFlowChatKakaoDarkBackground,
            bubbleOnBackground = NotiFlowChatKakaoDarkOnBackground,
            bubbleBorderColor = NotiFlowChatKakaoDarkBorder,
            bubbleShape = RoundedCornerShape(topStart = 8.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = NotiFlowChatKakaoDarkAccent,
            senderNameColor = NotiFlowChatKakaoDarkSender,
            dateHeaderColor = NotiFlowChatKakaoDarkDate,
            timelineLineColor = NotiFlowChatKakaoDarkTimeline,
            timelineDotColor = NotiFlowChatKakaoDarkTimelineDot
        )

        // ── Telegram ──
        private val telegramLight = AppChatStyle(
            bubbleBackground = NotiFlowChatTelegramBackground,
            bubbleOnBackground = NotiFlowChatTelegramOnBackground,
            bubbleBorderColor = NotiFlowChatTelegramBorder,
            bubbleShape = RoundedCornerShape(16.dp),
            accentColor = NotiFlowChatTelegramAccent,
            senderNameColor = NotiFlowChatTelegramSender,
            dateHeaderColor = NotiFlowChatTelegramDate,
            timelineLineColor = NotiFlowChatTelegramTimeline,
            timelineDotColor = NotiFlowChatTelegramTimelineDot
        )
        private val telegramDark = AppChatStyle(
            bubbleBackground = NotiFlowChatTelegramDarkBackground,
            bubbleOnBackground = NotiFlowChatTelegramDarkOnBackground,
            bubbleBorderColor = NotiFlowChatTelegramDarkBorder,
            bubbleShape = RoundedCornerShape(16.dp),
            accentColor = NotiFlowChatTelegramDarkAccent,
            senderNameColor = NotiFlowChatTelegramDarkSender,
            dateHeaderColor = NotiFlowChatTelegramDarkDate,
            timelineLineColor = NotiFlowChatTelegramDarkTimeline,
            timelineDotColor = NotiFlowChatTelegramDarkTimelineDot
        )

        // ── SMS ── (min corner 8dp)
        private val smsLight = AppChatStyle(
            bubbleBackground = NotiFlowChatSmsBackground,
            bubbleOnBackground = NotiFlowChatSmsOnBackground,
            bubbleBorderColor = NotiFlowChatSmsBorder,
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 8.dp),
            accentColor = NotiFlowChatSmsAccent,
            senderNameColor = NotiFlowChatSmsSender,
            dateHeaderColor = NotiFlowChatSmsDate,
            timelineLineColor = NotiFlowChatSmsTimeline,
            timelineDotColor = NotiFlowChatSmsTimelineDot
        )
        private val smsDark = AppChatStyle(
            bubbleBackground = NotiFlowChatSmsDarkBackground,
            bubbleOnBackground = NotiFlowChatSmsDarkOnBackground,
            bubbleBorderColor = NotiFlowChatSmsDarkBorder,
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 8.dp),
            accentColor = NotiFlowChatSmsDarkAccent,
            senderNameColor = NotiFlowChatSmsDarkSender,
            dateHeaderColor = NotiFlowChatSmsDarkDate,
            timelineLineColor = NotiFlowChatSmsDarkTimeline,
            timelineDotColor = NotiFlowChatSmsDarkTimelineDot
        )

        // ── WhatsApp ── (min corner 8dp)
        private val whatsAppLight = AppChatStyle(
            bubbleBackground = NotiFlowChatWhatsAppBackground,
            bubbleOnBackground = NotiFlowChatWhatsAppOnBackground,
            bubbleBorderColor = NotiFlowChatWhatsAppBorder,
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 8.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = NotiFlowChatWhatsAppAccent,
            senderNameColor = NotiFlowChatWhatsAppSender,
            dateHeaderColor = NotiFlowChatWhatsAppDate,
            timelineLineColor = NotiFlowChatWhatsAppTimeline,
            timelineDotColor = NotiFlowChatWhatsAppTimelineDot
        )
        private val whatsAppDark = AppChatStyle(
            bubbleBackground = NotiFlowChatWhatsAppDarkBackground,
            bubbleOnBackground = NotiFlowChatWhatsAppDarkOnBackground,
            bubbleBorderColor = NotiFlowChatWhatsAppDarkBorder,
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 8.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = NotiFlowChatWhatsAppDarkAccent,
            senderNameColor = NotiFlowChatWhatsAppDarkSender,
            dateHeaderColor = NotiFlowChatWhatsAppDarkDate,
            timelineLineColor = NotiFlowChatWhatsAppDarkTimeline,
            timelineDotColor = NotiFlowChatWhatsAppDarkTimelineDot
        )

        // ── Default (NotiFlow Indigo) ──
        private val defaultLight = AppChatStyle(
            bubbleBackground = NotiFlowChatDefaultBackground,
            bubbleOnBackground = NotiFlowChatDefaultOnBackground,
            bubbleBorderColor = NotiFlowChatDefaultBorder,
            bubbleShape = RoundedCornerShape(12.dp),
            accentColor = NotiFlowChatDefaultAccent,
            senderNameColor = NotiFlowChatDefaultSender,
            dateHeaderColor = NotiFlowChatDefaultDate,
            timelineLineColor = NotiFlowChatDefaultTimeline,
            timelineDotColor = NotiFlowChatDefaultTimelineDot
        )
        private val defaultDark = AppChatStyle(
            bubbleBackground = NotiFlowChatDefaultDarkBackground,
            bubbleOnBackground = NotiFlowChatDefaultDarkOnBackground,
            bubbleBorderColor = NotiFlowChatDefaultDarkBorder,
            bubbleShape = RoundedCornerShape(12.dp),
            accentColor = NotiFlowChatDefaultDarkAccent,
            senderNameColor = NotiFlowChatDefaultDarkSender,
            dateHeaderColor = NotiFlowChatDefaultDarkDate,
            timelineLineColor = NotiFlowChatDefaultDarkTimeline,
            timelineDotColor = NotiFlowChatDefaultDarkTimelineDot
        )
    }
}

@Composable
fun rememberAppChatStyle(source: String): AppChatStyle {
    val isDark = isSystemInDarkTheme()
    return remember(source, isDark) {
        AppChatStyle.fromSource(source, isDark)
    }
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/chat/AppChatStyle.kt
git commit -m "style: migrate AppChatStyle colors to Color.kt tokens

Replace all inline Color() values with NotiFlowChat* constants.
Fix minimum corner radius from 4dp to 8dp.
Update default theme from blue to NotiFlow Indigo."
```

---

## Task 7: Update SplashScreen.kt with NotiFlow Indigo branding

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/splash/SplashScreen.kt`

**Step 1: Replace hardcoded colors with NotiFlow Indigo variants**

All `Color(0xFF...)` values in SplashScreen need to change to indigo-based colors. Key replacements:

| Current Color | Meaning | New Color |
|---|---|---|
| `Color(0xFF0F172A)` / `Color(0xFF1E293B)` | Dark background gradient | `Color(0xFF0F0D1A)` / `Color(0xFF1C1A2E)` |
| `Color(0xFF3B82F6)` | Blue accents, pulse rings, central icon | `Color(0xFF6366F1)` (NotiFlow Indigo) |
| `Color(0xFF6366F1)` | Central icon gradient end | `Color(0xFF8B5CF6)` (NotiFlow Violet) |
| `Color(0xFF60A5FA)` | Orbital arc 1 | `Color(0xFF818CF8)` (Indigo Light) |
| `Color(0xFF818CF8)` | Orbital arc 2 | `Color(0xFFA78BFA)` (Violet Light) |
| `Color(0xFF38BDF8)` | Inner orbital arc | `Color(0xFFC4B5FD)` (Soft Lavender) |
| `Color(0xFFF43F5E)` | Email bubble | Keep (semantic red) |
| `Color(0xFF10B981)` | Schedule bubble | Keep (semantic green) |
| `Color(0xFFF59E0B)` | Notification bubble | `NotiFlowWarning` |
| `Color(0xFF8B5CF6)` | Send bubble | Keep (matches NotiFlow Violet) |
| `Color(0xFF94A3B8)` | Tagline text | `Color(0xFF9CA3AF)` |

Replace all occurrences in the file. The key is changing the overall color atmosphere from slate-blue to indigo-violet.

**Step 2: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/splash/SplashScreen.kt
git commit -m "style: update SplashScreen with NotiFlow Indigo branding

Replace slate-blue colors with indigo/violet palette.
Background gradient now uses NotiFlow dark indigo tones.
Pulse rings and orbitals use indigo/violet accents."
```

---

## Task 8: Fix hardcoded colors in message screens

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/message/MessageCard.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/message/MessageListScreen.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/message/MessageDetailScreen.kt`

**Step 1: Replace Color(0xFFF59E0B) with MaterialTheme.colorScheme references**

In all three files, search for `Color(0xFFF59E0B)` (amber/snooze color) and replace with:
```kotlin
NotiFlowWarning
```

Add the import `import com.hart.notimgmt.ui.theme.NotiFlowWarning` to each file.

**Step 2: Remove shadows from MessageCard.kt**

Find the `.shadow(elevation = 8.dp, ...)` block and replace with a border-only approach:
- Remove the `.shadow(...)` modifier
- Ensure the Surface already has `border = BorderStroke(0.5.dp, ...)` — adjust if needed

**Step 3: Fix non-4dp spacing in MessageCard.kt**

- `height(6.dp)` → `height(8.dp)`
- `height(10.dp)` → `height(12.dp)`

**Step 4: Fix font scaling in MessageListScreen.kt**

Replace all `fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.8f` with:
```kotlin
style = MaterialTheme.typography.labelSmall
```
(Remove the fontSize override entirely and use the full labelSmall style)

Similarly for `* 0.85f` patterns.

**Step 5: Fix search field corner radius in MessageListScreen.kt**

`RoundedCornerShape(10.dp)` → `RoundedCornerShape(12.dp)`

**Step 6: Fix bottom padding**

`92.dp` → `88.dp`

**Step 7: Fix non-4dp spacing in MessageDetailScreen.kt**

- `height(14.dp)` → `height(16.dp)`
- `height(10.dp)` → `height(12.dp)`

**Step 8: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/message/
git commit -m "style: unify message screens with NotiFlow design system

Replace hardcoded snooze color with NotiFlowWarning.
Remove card shadows, use 0.5dp border for depth.
Fix non-4dp spacing values to align with grid.
Remove manual font scaling (labelSmall * 0.8f).
Fix search field corner radius to 12dp."
```

---

## Task 9: Fix hardcoded styles in KanbanScreen and WeeklyPlannerScreen

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/kanban/KanbanScreen.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/kanban/WeeklyPlannerScreen.kt`

**Step 1: Remove shadows from KanbanScreen.kt**

Find both `.shadow(elevation = 8.dp, ...)` blocks and remove them. Ensure the corresponding Surface/Box has proper border styling.

**Step 2: Fix non-4dp spacing in KanbanScreen.kt**

- `padding(start = 14.dp, ...)` → `padding(start = 16.dp, ...)`
- `padding(10.dp)` → `padding(12.dp)`

**Step 3: Fix font scaling in KanbanScreen.kt**

Replace all 6 instances of `fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.8f` and `* 0.85f` with just using `MaterialTheme.typography.labelSmall` style directly.

**Step 4: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/kanban/
git commit -m "style: unify kanban screens with NotiFlow design system

Remove card shadows in favor of border-based depth.
Fix non-4dp spacing values.
Remove manual font scaling patterns."
```

---

## Task 10: Fix hardcoded styles in remaining screens

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/chat/AppChatScreen.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/calendar/CalendarScreen.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/filter/FilterScreen.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/filter/CategoryEditDialog.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/onboarding/OnboardingScreen.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/insight/InsightSection.kt`

**Step 1: AppChatScreen.kt — Fix font scaling**

Replace `fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.85f` with just using `labelSmall` style.

**Step 2: CalendarScreen.kt — Fix font scaling and DEFAULT_CATEGORY_COLOR usage**

Replace font scaling patterns. Check `DEFAULT_CATEGORY_COLOR` usage — the value already changed in Color.kt.

**Step 3: FilterScreen.kt — Remove shadows**

Find and remove all `.shadow(...)` modifiers. Ensure Glass Surface components retain their border styling.

**Step 4: CategoryEditDialog.kt — Remove shadows**

Remove `.shadow(...)` modifier.

**Step 5: OnboardingScreen.kt — Remove shadows and update hardcoded colors**

Remove all `.shadow(...)` modifiers (5 instances). Update any hardcoded Color values to use NotiFlow theme colors.

**Step 6: InsightSection.kt — Check for hardcoded colors**

Replace any remaining hardcoded Color() values.

**Step 7: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/chat/AppChatScreen.kt \
      apps/mobile/app/src/main/java/com/hart/notimgmt/ui/calendar/ \
      apps/mobile/app/src/main/java/com/hart/notimgmt/ui/filter/ \
      apps/mobile/app/src/main/java/com/hart/notimgmt/ui/onboarding/ \
      apps/mobile/app/src/main/java/com/hart/notimgmt/ui/insight/
git commit -m "style: unify remaining screens with NotiFlow design system

Remove shadows from filter, category, and onboarding screens.
Fix font scaling in chat and calendar screens.
Update hardcoded colors to NotiFlow theme tokens."
```

---

## Task 11: Remove shadows from GlassComponents.kt

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/components/GlassComponents.kt`

**Step 1: Replace shadow modifiers**

GlassComponents has 3 `.shadow(...)` calls. Per the design spec, glass components should use border-based depth, not shadows. Remove each `.shadow(...)` modifier while keeping the BorderStroke.

**Step 2: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/components/GlassComponents.kt
git commit -m "style: remove shadows from GlassComponents

Use border-based depth per NotiFlow design spec.
Glass components rely on 0.5dp borders for visual depth."
```

---

## Task 12: Update DESIGN.md for NotiFlow branding

**Files:**
- Modify: `apps/mobile/DESIGN.md`

**Step 1: Rebrand the entire document**

- Line 1: `# MedNoti Design System` → `# NotiFlow Design System`
- Line 3: Remove "TWS (투어스)" references → "NotiFlow"
- Update all color hex codes to match new Indigo palette
- Update `TwsTheme.glassColors` → `NotiFlowDesign.glassColors`
- Update all component specs to reflect new values (no shadows, etc.)
- Update typography section to mention Pretendard

**Step 2: Commit**

```bash
git add apps/mobile/DESIGN.md
git commit -m "docs: update DESIGN.md with NotiFlow Indigo branding

Rebrand from MedNoti/TWS to NotiFlow throughout.
Update color palette to Indigo (#6366F1) based system.
Update typography to reference Pretendard font.
Clarify no-shadow policy in component specs."
```

---

## Task 13: Build and verify

**Step 1: Full project build**

```bash
cd /mnt/d/Project/09_NotiFlow/apps/mobile && ./gradlew assembleDebug 2>&1 | tail -100
```

Expected: BUILD SUCCESSFUL

**Step 2: If build fails, fix remaining compile errors**

Common issues to check:
- Remaining `Tws*` references in files not covered above
- Missing imports for `NotiFlowDesign`
- `Typography` name conflicts (deprecated alias should handle)

Search for any remaining references:
```bash
grep -rn "Tws" apps/mobile/app/src/main/java/com/hart/notimgmt/ --include="*.kt" | grep -v "\.kt:.*//.*Tws"
```

Fix each remaining reference.

**Step 3: Commit any remaining fixes**

```bash
git add -A apps/mobile/
git commit -m "fix: resolve remaining Tws* references for clean build"
```

---

## Task 14: Final verification and tag

**Step 1: Run the app on emulator/device**

Visually verify:
- [ ] Splash screen shows indigo/violet branding
- [ ] Bottom navigation uses indigo active color
- [ ] Dashboard header shows indigo gradient
- [ ] Message cards have no shadows, use borders
- [ ] Chat bubbles display correct per-app colors
- [ ] Dark mode switches to deep indigo tones
- [ ] Pretendard font is visibly applied (check Korean text)
- [ ] Settings screen uses consistent card styling
- [ ] Calendar/Kanban screens follow design system

**Step 2: Final commit if any visual fixes needed**

```bash
git add -A apps/mobile/
git commit -m "style: final visual adjustments for NotiFlow design unification"
```
