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
