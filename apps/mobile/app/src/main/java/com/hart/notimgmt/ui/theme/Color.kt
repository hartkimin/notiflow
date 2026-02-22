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
