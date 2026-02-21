package com.hart.notimgmt.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ViewKanban
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    data object Dashboard : Screen("dashboard", "대화방", Icons.Default.Home)
    data object Messages : Screen("messages?statusFilter={statusFilter}&completedToday={completedToday}", "메시지", Icons.AutoMirrored.Filled.Message) {
        const val BASE_ROUTE = "messages"
        fun createRoute(statusFilter: String? = null, completedToday: Boolean = false): String {
            val params = mutableListOf<String>()
            if (statusFilter != null) params.add("statusFilter=$statusFilter")
            if (completedToday) params.add("completedToday=true")
            return if (params.isEmpty()) "messages" else "messages?${params.joinToString("&")}"
        }
    }
    data object AiChat : Screen("ai_chat", "AI", Icons.Default.AutoAwesome)
    data object Kanban : Screen("kanban", "스케쥴", Icons.Default.ViewKanban)
    data object Settings : Screen("settings", "설정", Icons.Default.Settings)
}

object Routes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val ONBOARDING = "onboarding"
    const val MAIN = "main"
    const val MESSAGE_DETAIL = "message_detail/{messageId}"
    const val TRASH = "trash"

    fun messageDetail(messageId: String) = "message_detail/$messageId"
}
