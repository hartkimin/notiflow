# NotiFlow Tutorial (Onboarding Guide) Design

## Overview

앱 최초 설치 후 온보딩 완료 직후에 5페이지짜리 풀스크린 튜토리얼을 표시한다.
각 페이지는 네비게이션 탭 하나에 대응하며, Lottie 애니메이션 + 설명 텍스트로 구성된다.
설정 화면에서 "사용 안내 다시 보기"로 언제든 재열람 가능하다.

## Architecture

### Startup Flow

```
SPLASH → ONBOARDING → TUTORIAL → LOGIN → MAIN
                      (신규만)
```

- `AppPreferences`에 `isTutorialSeen: Boolean` 추가
- `AppNavigation.kt`의 `startDestination` 분기에 튜토리얼 조건 추가:
  - `!isOnboardingCompleted` → ONBOARDING
  - `isOnboardingCompleted && !isTutorialSeen` → TUTORIAL
  - else → LOGIN or MAIN
- 온보딩 완료 콜백에서 TUTORIAL로 네비게이트

### Navigation Route

```kotlin
object Routes {
    const val TUTORIAL = "tutorial"
}
```

- 최상위 NavHost에 `composable(Routes.TUTORIAL)` 추가
- 뒤로가기 비활성화 (`BackHandler` 무시 또는 popBackStack 방지)

## Content (5 Pages)

| Page | Tab         | Title           | Description                                    |
|------|-------------|-----------------|------------------------------------------------|
| 1    | 대화방       | 대화방 관리       | 앱별 메시지를 대화방 형태로 확인하고 검색할 수 있어요 |
| 2    | 타임라인      | 메시지 타임라인    | 모든 알림을 시간순으로 보고 상태를 관리해요         |
| 3    | AI 분석      | AI 분석          | AI가 메시지를 자동 분석하고 카테고리를 분류해요     |
| 4    | 스케줄(칸반)  | 스케줄 보드       | 칸반 보드로 메시지 처리 상태를 관리해요            |
| 5    | 설정         | 맞춤 설정        | 카테고리, 필터, 백업 등 나만의 설정을 할 수 있어요  |

- 각 페이지에 Lottie 애니메이션 파일 (res/raw/)
- 텍스트는 하드코딩 (다국어 지원 시 strings.xml 이동 가능)

## UI Structure

```
NotiFlowBackground {
    Column(fillMaxSize) {
        // Skip button (top-right)
        TextButton("건너뛰기") → markSeen + navigate

        // Lottie animation (weight 0.5f)
        LottieAnimation(
            composition = page.lottieRes,
            iterations = LottieConstants.IterateForever,
            modifier = Modifier.weight(0.5f)
        )

        // Text content
        Text(title, headlineMedium, Bold)
        Text(description, bodyLarge, onSurfaceVariant)

        // Page indicators (HorizontalPagerIndicator style)
        Row { indicators }

        // Navigation buttons
        if (isLastPage) {
            GlassButton("시작하기") → markSeen + navigate
        } else {
            GlassButton("다음") → animateScrollToPage(page + 1)
        }
    }
}
```

- `HorizontalPager` (Accompanist 불필요, Compose Foundation 내장)
- Swipe 제스처로도 페이지 이동 가능
- 페이지 인디케이터: 현재 페이지는 `NotiFlowIndigo`, 나머지는 `onSurfaceVariant.copy(alpha=0.3f)`
- NotiFlow Glassmorphism 디자인 시스템 준수 (GlassButton, NotiFlowBackground)

## Settings Integration

`GeneralScreen.kt` 설정 화면에 항목 추가:

```
[사용 안내 다시 보기]  →  navController.navigate(Routes.TUTORIAL)
```

- 설정에서 진입 시에는 `isTutorialSeen`을 변경하지 않음 (이미 true)
- 뒤로가기로 설정 화면 복귀 가능 (최초 진입과 다른 동작)
- `fromSettings: Boolean` 파라미터로 구분

## File Structure

```
ui/tutorial/
├── TutorialScreen.kt      // HorizontalPager + 전체 레이아웃
└── TutorialPage.kt         // 단일 페이지 composable (data class + UI)

res/raw/
├── tutorial_chatroom.json   // Lottie: 대화방
├── tutorial_timeline.json   // Lottie: 타임라인
├── tutorial_ai.json         // Lottie: AI 분석
├── tutorial_kanban.json     // Lottie: 칸반
└── tutorial_settings.json   // Lottie: 설정
```

## Dependencies

- `com.airbnb.lottie:lottie-compose:6.x` (build.gradle.kts에 추가)
- Lottie JSON 파일은 LottieFiles.com에서 적절한 애니메이션 선택 후 res/raw/에 배치

## Edge Cases

- 온보딩 → 튜토리얼 전환 시 백스택 클리어 (`popUpTo(ONBOARDING) { inclusive = true }`)
- 설정에서 재열람 시 뒤로가기 = 설정 복귀 (popBackStack)
- Lottie 파일 로드 실패 시 graceful fallback (빈 Box 또는 static 이미지)
