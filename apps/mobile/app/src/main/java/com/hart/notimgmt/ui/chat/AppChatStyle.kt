package com.hart.notimgmt.ui.chat

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

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
            // KakaoTalk
            source.contains("kakao", ignoreCase = true) -> if (isDark) kakaoTalkDark else kakaoTalkLight
            // Telegram
            source.contains("telegram", ignoreCase = true) -> if (isDark) telegramDark else telegramLight
            // SMS / Android Messages
            source.contains("sms", ignoreCase = true) ||
            source.contains("messaging", ignoreCase = true) ||
            source.contains("com.google.android.apps.messaging", ignoreCase = true) ||
            source.contains("com.samsung.android.messaging", ignoreCase = true) -> if (isDark) smsDark else smsLight
            // WhatsApp
            source.contains("whatsapp", ignoreCase = true) -> if (isDark) whatsAppDark else whatsAppLight
            // Default
            else -> if (isDark) defaultDark else defaultLight
        }

        // ── KakaoTalk ──
        private val kakaoTalkLight = AppChatStyle(
            bubbleBackground = Color(0xFFFFF9C4),
            bubbleOnBackground = Color(0xFF3E2723),
            bubbleBorderColor = Color(0xFFFFE082),
            bubbleShape = RoundedCornerShape(topStart = 4.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = Color(0xFFFEE500),
            senderNameColor = Color(0xFF795548),
            dateHeaderColor = Color(0xFF5D4037),
            timelineLineColor = Color(0xFFFFE082),
            timelineDotColor = Color(0xFFFFC107)
        )
        private val kakaoTalkDark = AppChatStyle(
            bubbleBackground = Color(0xFF3E2723),
            bubbleOnBackground = Color(0xFFFFF9C4),
            bubbleBorderColor = Color(0xFF5D4037),
            bubbleShape = RoundedCornerShape(topStart = 4.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = Color(0xFFFFC107),
            senderNameColor = Color(0xFFFFE082),
            dateHeaderColor = Color(0xFFFFE082),
            timelineLineColor = Color(0xFF5D4037),
            timelineDotColor = Color(0xFFFFC107)
        )

        // ── Telegram ──
        private val telegramLight = AppChatStyle(
            bubbleBackground = Color(0xFFE3F2FD),
            bubbleOnBackground = Color(0xFF1A237E),
            bubbleBorderColor = Color(0xFFBBDEFB),
            bubbleShape = RoundedCornerShape(16.dp),
            accentColor = Color(0xFF2196F3),
            senderNameColor = Color(0xFF1565C0),
            dateHeaderColor = Color(0xFF1565C0),
            timelineLineColor = Color(0xFFBBDEFB),
            timelineDotColor = Color(0xFF2196F3)
        )
        private val telegramDark = AppChatStyle(
            bubbleBackground = Color(0xFF1A237E),
            bubbleOnBackground = Color(0xFFE3F2FD),
            bubbleBorderColor = Color(0xFF283593),
            bubbleShape = RoundedCornerShape(16.dp),
            accentColor = Color(0xFF64B5F6),
            senderNameColor = Color(0xFF90CAF9),
            dateHeaderColor = Color(0xFF90CAF9),
            timelineLineColor = Color(0xFF283593),
            timelineDotColor = Color(0xFF64B5F6)
        )

        // ── SMS ──
        private val smsLight = AppChatStyle(
            bubbleBackground = Color(0xFFE8F5E9),
            bubbleOnBackground = Color(0xFF1B5E20),
            bubbleBorderColor = Color(0xFFC8E6C9),
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 4.dp),
            accentColor = Color(0xFF4CAF50),
            senderNameColor = Color(0xFF2E7D32),
            dateHeaderColor = Color(0xFF2E7D32),
            timelineLineColor = Color(0xFFC8E6C9),
            timelineDotColor = Color(0xFF4CAF50)
        )
        private val smsDark = AppChatStyle(
            bubbleBackground = Color(0xFF1B5E20),
            bubbleOnBackground = Color(0xFFE8F5E9),
            bubbleBorderColor = Color(0xFF2E7D32),
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 4.dp),
            accentColor = Color(0xFF66BB6A),
            senderNameColor = Color(0xFFA5D6A7),
            dateHeaderColor = Color(0xFFA5D6A7),
            timelineLineColor = Color(0xFF2E7D32),
            timelineDotColor = Color(0xFF66BB6A)
        )

        // ── WhatsApp ──
        private val whatsAppLight = AppChatStyle(
            bubbleBackground = Color(0xFFDCF8C6),
            bubbleOnBackground = Color(0xFF1B3A1B),
            bubbleBorderColor = Color(0xFFC5E1A5),
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 4.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = Color(0xFF25D366),
            senderNameColor = Color(0xFF075E54),
            dateHeaderColor = Color(0xFF075E54),
            timelineLineColor = Color(0xFFC5E1A5),
            timelineDotColor = Color(0xFF25D366)
        )
        private val whatsAppDark = AppChatStyle(
            bubbleBackground = Color(0xFF054640),
            bubbleOnBackground = Color(0xFFDCF8C6),
            bubbleBorderColor = Color(0xFF075E54),
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 4.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = Color(0xFF25D366),
            senderNameColor = Color(0xFF80CBC4),
            dateHeaderColor = Color(0xFF80CBC4),
            timelineLineColor = Color(0xFF075E54),
            timelineDotColor = Color(0xFF25D366)
        )

        // ── Default (NotiFlow) ──
        private val defaultLight = AppChatStyle(
            bubbleBackground = Color(0xFFF1F5F9),
            bubbleOnBackground = Color(0xFF1E293B),
            bubbleBorderColor = Color(0xFFE2E8F0),
            bubbleShape = RoundedCornerShape(12.dp),
            accentColor = Color(0xFF3B82F6),
            senderNameColor = Color(0xFF3B82F6),
            dateHeaderColor = Color(0xFF475569),
            timelineLineColor = Color(0xFFE2E8F0),
            timelineDotColor = Color(0xFF3B82F6)
        )
        private val defaultDark = AppChatStyle(
            bubbleBackground = Color(0xFF1E293B),
            bubbleOnBackground = Color(0xFFE2E8F0),
            bubbleBorderColor = Color(0xFF334155),
            bubbleShape = RoundedCornerShape(12.dp),
            accentColor = Color(0xFF60A5FA),
            senderNameColor = Color(0xFF60A5FA),
            dateHeaderColor = Color(0xFF94A3B8),
            timelineLineColor = Color(0xFF334155),
            timelineDotColor = Color(0xFF60A5FA)
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
