package com.hart.notimgmt.ui.tutorial

import androidx.annotation.RawRes
import com.hart.notimgmt.R

data class TutorialPage(
    val title: String,
    val description: String,
    @RawRes val lottieRes: Int
)

val tutorialPages = listOf(
    TutorialPage(
        title = "대화방 관리",
        description = "앱별 메시지를 대화방 형태로 확인하고\n검색할 수 있어요",
        lottieRes = R.raw.tutorial_chatroom
    ),
    TutorialPage(
        title = "메시지 타임라인",
        description = "모든 알림을 시간순으로 보고\n상태를 관리해요",
        lottieRes = R.raw.tutorial_timeline
    ),
    TutorialPage(
        title = "AI 분석",
        description = "AI가 메시지를 자동 분석하고\n카테고리를 분류해요",
        lottieRes = R.raw.tutorial_ai
    ),
    TutorialPage(
        title = "스케줄 보드",
        description = "칸반 보드로 메시지 처리 상태를\n관리해요",
        lottieRes = R.raw.tutorial_kanban
    ),
    TutorialPage(
        title = "맞춤 설정",
        description = "카테고리, 필터, 백업 등\n나만의 설정을 할 수 있어요",
        lottieRes = R.raw.tutorial_settings
    )
)
