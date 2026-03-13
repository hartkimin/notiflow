package com.hart.notimgmt.ui.chat

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
            bubbleBackground = NotiRouteChatKakaoBackground,
            bubbleOnBackground = NotiRouteChatKakaoOnBackground,
            bubbleBorderColor = NotiRouteChatKakaoBorder,
            bubbleShape = RoundedCornerShape(topStart = 8.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = NotiRouteChatKakaoAccent,
            senderNameColor = NotiRouteChatKakaoSender,
            dateHeaderColor = NotiRouteChatKakaoDate,
            timelineLineColor = NotiRouteChatKakaoTimeline,
            timelineDotColor = NotiRouteChatKakaoTimelineDot
        )
        private val kakaoTalkDark = AppChatStyle(
            bubbleBackground = NotiRouteChatKakaoDarkBackground,
            bubbleOnBackground = NotiRouteChatKakaoDarkOnBackground,
            bubbleBorderColor = NotiRouteChatKakaoDarkBorder,
            bubbleShape = RoundedCornerShape(topStart = 8.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = NotiRouteChatKakaoDarkAccent,
            senderNameColor = NotiRouteChatKakaoDarkSender,
            dateHeaderColor = NotiRouteChatKakaoDarkDate,
            timelineLineColor = NotiRouteChatKakaoDarkTimeline,
            timelineDotColor = NotiRouteChatKakaoDarkTimelineDot
        )

        // ── Telegram ──
        private val telegramLight = AppChatStyle(
            bubbleBackground = NotiRouteChatTelegramBackground,
            bubbleOnBackground = NotiRouteChatTelegramOnBackground,
            bubbleBorderColor = NotiRouteChatTelegramBorder,
            bubbleShape = RoundedCornerShape(16.dp),
            accentColor = NotiRouteChatTelegramAccent,
            senderNameColor = NotiRouteChatTelegramSender,
            dateHeaderColor = NotiRouteChatTelegramDate,
            timelineLineColor = NotiRouteChatTelegramTimeline,
            timelineDotColor = NotiRouteChatTelegramTimelineDot
        )
        private val telegramDark = AppChatStyle(
            bubbleBackground = NotiRouteChatTelegramDarkBackground,
            bubbleOnBackground = NotiRouteChatTelegramDarkOnBackground,
            bubbleBorderColor = NotiRouteChatTelegramDarkBorder,
            bubbleShape = RoundedCornerShape(16.dp),
            accentColor = NotiRouteChatTelegramDarkAccent,
            senderNameColor = NotiRouteChatTelegramDarkSender,
            dateHeaderColor = NotiRouteChatTelegramDarkDate,
            timelineLineColor = NotiRouteChatTelegramDarkTimeline,
            timelineDotColor = NotiRouteChatTelegramDarkTimelineDot
        )

        // ── SMS ── (min corner 8dp)
        private val smsLight = AppChatStyle(
            bubbleBackground = NotiRouteChatSmsBackground,
            bubbleOnBackground = NotiRouteChatSmsOnBackground,
            bubbleBorderColor = NotiRouteChatSmsBorder,
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 8.dp),
            accentColor = NotiRouteChatSmsAccent,
            senderNameColor = NotiRouteChatSmsSender,
            dateHeaderColor = NotiRouteChatSmsDate,
            timelineLineColor = NotiRouteChatSmsTimeline,
            timelineDotColor = NotiRouteChatSmsTimelineDot
        )
        private val smsDark = AppChatStyle(
            bubbleBackground = NotiRouteChatSmsDarkBackground,
            bubbleOnBackground = NotiRouteChatSmsDarkOnBackground,
            bubbleBorderColor = NotiRouteChatSmsDarkBorder,
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 8.dp),
            accentColor = NotiRouteChatSmsDarkAccent,
            senderNameColor = NotiRouteChatSmsDarkSender,
            dateHeaderColor = NotiRouteChatSmsDarkDate,
            timelineLineColor = NotiRouteChatSmsDarkTimeline,
            timelineDotColor = NotiRouteChatSmsDarkTimelineDot
        )

        // ── WhatsApp ── (min corner 8dp)
        private val whatsAppLight = AppChatStyle(
            bubbleBackground = NotiRouteChatWhatsAppBackground,
            bubbleOnBackground = NotiRouteChatWhatsAppOnBackground,
            bubbleBorderColor = NotiRouteChatWhatsAppBorder,
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 8.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = NotiRouteChatWhatsAppAccent,
            senderNameColor = NotiRouteChatWhatsAppSender,
            dateHeaderColor = NotiRouteChatWhatsAppDate,
            timelineLineColor = NotiRouteChatWhatsAppTimeline,
            timelineDotColor = NotiRouteChatWhatsAppTimelineDot
        )
        private val whatsAppDark = AppChatStyle(
            bubbleBackground = NotiRouteChatWhatsAppDarkBackground,
            bubbleOnBackground = NotiRouteChatWhatsAppDarkOnBackground,
            bubbleBorderColor = NotiRouteChatWhatsAppDarkBorder,
            bubbleShape = RoundedCornerShape(topStart = 16.dp, topEnd = 8.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            accentColor = NotiRouteChatWhatsAppDarkAccent,
            senderNameColor = NotiRouteChatWhatsAppDarkSender,
            dateHeaderColor = NotiRouteChatWhatsAppDarkDate,
            timelineLineColor = NotiRouteChatWhatsAppDarkTimeline,
            timelineDotColor = NotiRouteChatWhatsAppDarkTimelineDot
        )

        // ── Default (NotiRoute Indigo) ──
        private val defaultLight = AppChatStyle(
            bubbleBackground = NotiRouteChatDefaultBackground,
            bubbleOnBackground = NotiRouteChatDefaultOnBackground,
            bubbleBorderColor = NotiRouteChatDefaultBorder,
            bubbleShape = RoundedCornerShape(12.dp),
            accentColor = NotiRouteChatDefaultAccent,
            senderNameColor = NotiRouteChatDefaultSender,
            dateHeaderColor = NotiRouteChatDefaultDate,
            timelineLineColor = NotiRouteChatDefaultTimeline,
            timelineDotColor = NotiRouteChatDefaultTimelineDot
        )
        private val defaultDark = AppChatStyle(
            bubbleBackground = NotiRouteChatDefaultDarkBackground,
            bubbleOnBackground = NotiRouteChatDefaultDarkOnBackground,
            bubbleBorderColor = NotiRouteChatDefaultDarkBorder,
            bubbleShape = RoundedCornerShape(12.dp),
            accentColor = NotiRouteChatDefaultDarkAccent,
            senderNameColor = NotiRouteChatDefaultDarkSender,
            dateHeaderColor = NotiRouteChatDefaultDarkDate,
            timelineLineColor = NotiRouteChatDefaultDarkTimeline,
            timelineDotColor = NotiRouteChatDefaultDarkTimelineDot
        )
    }
}

@Composable
fun rememberAppChatStyle(source: String): AppChatStyle {
    val isDark = LocalIsDarkTheme.current
    return remember(source, isDark) {
        AppChatStyle.fromSource(source, isDark)
    }
}

