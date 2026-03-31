package com.hart.notimgmt.ui.tutorial

import com.hart.notimgmt.R

data class TutorialPage(
    val title: String,
    val description: String,
    val lottieRes: Int
)

val tutorialPages = listOf(
    TutorialPage(
        title = "스마트 타임라인",
        description = "카카오톡, SMS 등의 주문 알림을 시간순으로 자동 정리합니다",
        lottieRes = R.raw.tutorial_timeline
    ),
    TutorialPage(
        title = "대화방 관리",
        description = "앱별 메시지를 대화방 형태로 깔끔하게 확인하고 검색하세요",
        lottieRes = R.raw.tutorial_chatroom
    ),
    TutorialPage(
        title = "AI 자동 분류",
        description = "AI가 메시지를 분석하여 투석 용품 주문을 자동으로 분류합니다",
        lottieRes = R.raw.tutorial_ai
    ),
    TutorialPage(
        title = "스케줄 보드",
        description = "칸반 보드로 주문 처리 상태를 직관적으로 관리하세요",
        lottieRes = R.raw.tutorial_kanban
    ),
    TutorialPage(
        title = "맞춤 설정",
        description = "카테고리, 필터, 클라우드 백업을 내 환경에 맞게 설정하세요",
        lottieRes = R.raw.tutorial_settings
    )
)
