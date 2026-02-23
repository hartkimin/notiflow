package com.hart.notimgmt.ui.tutorial

data class TutorialPage(
    val title: String,
    val description: String,
    val demoType: DemoType
)

val tutorialPages = listOf(
    TutorialPage(
        title = "Smart Timeline",
        description = "View all your notifications organized chronologically with AI-powered insights.",
        demoType = DemoType.TIMELINE
    ),
    TutorialPage(
        title = "Chatroom Management",
        description = "Check and search app-specific messages neatly organized by conversational rooms.",
        demoType = DemoType.CHATROOM
    ),
    TutorialPage(
        title = "AI Analysis",
        description = "Let AI automatically analyze messages and categorize their intent.",
        demoType = DemoType.AI_INSIGHTS
    ),
    TutorialPage(
        title = "Schedule Board",
        description = "Manage notification processing states via an intuitive Kanban board.",
        demoType = DemoType.KANBAN
    ),
    TutorialPage(
        title = "Custom Settings",
        description = "Personalize categories, configure filters, and enable cloud backups.",
        demoType = DemoType.SETTINGS
    )
)
