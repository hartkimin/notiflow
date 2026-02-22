# NotiFlow Tutorial Implementation Plan

> **For Claude:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 앱 최초 설치 후 온보딩 완료 직후에 5페이지 풀스크린 튜토리얼을 표시하고, 설정에서 재열람 가능하게 한다.

**Architecture:** `HorizontalPager` 기반 5페이지 튜토리얼 화면을 최상위 NavHost에 추가. `AppPreferences.isTutorialSeen`으로 최초 1회 표시 제어. Lottie 애니메이션 + 텍스트 구성. 설정의 "사용 안내 다시 보기"로 재진입.

**Tech Stack:** Jetpack Compose Foundation (`HorizontalPager`, `rememberPagerState`), Lottie Compose 6.x, Material 3, Hilt Navigation

---

## Task 1: Add Lottie dependency to build.gradle.kts

**Files:**
- Modify: `apps/mobile/app/build.gradle.kts:127` (before closing `}` of dependencies block)

**Implementation:**

After the `security-crypto` line (~line 126), add:

```kotlin
    // Lottie for animations
    implementation("com.airbnb.android:lottie-compose:6.6.2")
```

**Verification:**

Run: `cmd.exe /c "cd /mnt/d/Project/09_NotiFlow/apps/mobile && gradlew.bat :app:dependencies --configuration releaseRuntimeClasspath" | grep lottie`
Expected: Line showing `com.airbnb.android:lottie-compose:6.6.2`

**Commit:** `build(mobile): add lottie-compose dependency for tutorial animations`

---

## Task 2: Add placeholder Lottie JSON files

**Files:**
- Create: `apps/mobile/app/src/main/res/raw/tutorial_chatroom.json`
- Create: `apps/mobile/app/src/main/res/raw/tutorial_timeline.json`
- Create: `apps/mobile/app/src/main/res/raw/tutorial_ai.json`
- Create: `apps/mobile/app/src/main/res/raw/tutorial_kanban.json`
- Create: `apps/mobile/app/src/main/res/raw/tutorial_settings.json`

**Implementation:**

Each file is a minimal valid Lottie JSON (a single blue circle animation) so the build compiles and Lottie doesn't crash. These will be replaced with real animations later.

```json
{"v":"5.7.4","fr":30,"ip":0,"op":60,"w":400,"h":400,"nm":"placeholder","ddd":0,"assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"circle","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":0,"k":0},"p":{"a":0,"k":[200,200,0]},"a":{"a":0,"k":[0,0,0]},"s":{"a":1,"k":[{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":0,"s":[80,80,100]},{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":30,"s":[100,100,100]},{"t":60,"s":[80,80,100]}]}},"ao":0,"shapes":[{"ty":"el","d":1,"s":{"a":0,"k":[120,120]},"p":{"a":0,"k":[0,0]},"nm":"ellipse"},{"ty":"fl","c":{"a":0,"k":[0.388,0.4,0.945,1]},"o":{"a":0,"k":100},"r":1,"bm":0,"nm":"fill"}],"ip":0,"op":60,"st":0}]}
```

**Note:** All 5 files use the same placeholder. The animation is a pulsing indigo circle (NotiFlowIndigo). Real Lottie files from LottieFiles.com should replace these later.

**Commit:** `feat(mobile): add placeholder Lottie files for tutorial pages`

---

## Task 3: Add `isTutorialSeen` to AppPreferences

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/data/preferences/AppPreferences.kt`

**Implementation:**

After `isOnboardingCompleted` (line 119), add:

```kotlin
    var isTutorialSeen: Boolean
        get() = prefs.getBoolean("tutorial_seen", false)
        set(value) {
            prefs.edit().putBoolean("tutorial_seen", value).apply()
        }
```

**Pattern reference:** Follows exact same pattern as `isOnboardingCompleted` (line 115–119).

**Commit:** `feat(mobile): add isTutorialSeen preference for tutorial flow`

---

## Task 4: Add `TUTORIAL` route to Screen.kt

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/navigation/Screen.kt`

**Implementation:**

In the `Routes` object (line 27), add after `ONBOARDING`:

```kotlin
    const val TUTORIAL = "tutorial"
    const val TUTORIAL_FROM_SETTINGS = "tutorial?fromSettings=true"
```

**Commit:** `feat(mobile): add tutorial navigation routes`

---

## Task 5: Create TutorialPage data class

**Files:**
- Create: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/tutorial/TutorialPage.kt`

**Implementation:**

```kotlin
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
```

**Commit:** `feat(mobile): add TutorialPage data model with page content`

---

## Task 6: Create TutorialScreen composable

**Files:**
- Create: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/tutorial/TutorialScreen.kt`

**Implementation:**

```kotlin
package com.hart.notimgmt.ui.tutorial

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.LottieConstants
import com.airbnb.lottie.compose.rememberLottieComposition
import com.hart.notimgmt.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun TutorialScreen(
    fromSettings: Boolean = false,
    onComplete: () -> Unit
) {
    val pagerState = rememberPagerState(pageCount = { tutorialPages.size })
    val coroutineScope = rememberCoroutineScope()
    val glassColors = NotiFlowDesign.glassColors
    val isLastPage = pagerState.currentPage == tutorialPages.lastIndex

    // 최초 진입 시 뒤로가기 비활성화. 설정에서 진입 시에는 뒤로가기 허용.
    if (!fromSettings) {
        BackHandler { /* block back press */ }
    } else {
        BackHandler { onComplete() }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // 배경: 온보딩과 동일한 그라데이션 오버레이 스타일
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            glassColors.gradientStart,
                            glassColors.gradientMiddle,
                            glassColors.gradientEnd
                        )
                    )
                )
        )

        Column(modifier = Modifier.fillMaxSize()) {
            // 건너뛰기 버튼 (마지막 페이지에서는 숨김)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.End
            ) {
                if (!isLastPage) {
                    TextButton(onClick = onComplete) {
                        Text(
                            "건너뛰기",
                            color = NotiFlowWhite.copy(alpha = 0.8f)
                        )
                    }
                } else {
                    Spacer(modifier = Modifier.height(48.dp))
                }
            }

            // 페이지 콘텐츠
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.weight(1f)
            ) { page ->
                TutorialPageContent(tutorialPages[page])
            }

            // 하단 바: 인디케이터 + 버튼
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = NotiFlowGlassWhite,
                border = BorderStroke(1.dp, NotiFlowGlassBorderLight)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // 페이지 인디케이터
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        repeat(tutorialPages.size) { index ->
                            val color by animateColorAsState(
                                targetValue = if (index == pagerState.currentPage)
                                    NotiFlowIndigo
                                else
                                    NotiFlowIndigo.copy(alpha = 0.3f),
                                label = "indicator"
                            )
                            Box(
                                modifier = Modifier
                                    .size(if (index == pagerState.currentPage) 10.dp else 8.dp)
                                    .clip(CircleShape)
                                    .background(color)
                            )
                            if (index < tutorialPages.lastIndex) {
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // 다음 / 시작하기 버튼
                    Button(
                        onClick = {
                            if (isLastPage) {
                                onComplete()
                            } else {
                                coroutineScope.launch {
                                    pagerState.animateScrollToPage(pagerState.currentPage + 1)
                                }
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = NotiFlowIndigo
                        )
                    ) {
                        Text(
                            text = if (isLastPage) "시작하기" else "다음",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = NotiFlowWhite
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TutorialPageContent(page: TutorialPage) {
    val composition by rememberLottieComposition(
        LottieCompositionSpec.RawRes(page.lottieRes)
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Lottie 애니메이션
        Box(
            modifier = Modifier
                .weight(0.5f)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            LottieAnimation(
                composition = composition,
                iterations = LottieConstants.IterateForever,
                modifier = Modifier.size(240.dp)
            )
        }

        // 타이틀
        Text(
            text = page.title,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = NotiFlowWhite,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        // 설명
        Text(
            text = page.description,
            style = MaterialTheme.typography.bodyLarge,
            color = NotiFlowWhite.copy(alpha = 0.8f),
            textAlign = TextAlign.Center,
            lineHeight = MaterialTheme.typography.bodyLarge.lineHeight
        )

        Spacer(modifier = Modifier.weight(0.2f))
    }
}
```

**Key design decisions:**
- Background: Same gradient as onboarding (glassColors.gradientStart/Middle/End) — consistent brand
- Bottom bar: Same pattern as `OnboardingScreen.kt` — `Surface(color = NotiFlowGlassWhite, border = NotiFlowGlassBorderLight)`
- Indicators: Same animated dot pattern as `OnboardingScreen.kt` (line 173–193)
- Button: Same NotiFlowIndigo `Button` as `OnboardingScreen.kt` (line 204–234)
- `BackHandler`: blocks back press during first-run, allows it when re-viewing from settings
- Lottie: `LottieConstants.IterateForever` for continuous animation

**Commit:** `feat(mobile): add TutorialScreen with pager and Lottie animations`

---

## Task 7: Wire TutorialScreen into AppNavigation

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/navigation/AppNavigation.kt`

**Changes:**

### 7a. Add imports (top of file)

```kotlin
import com.hart.notimgmt.ui.tutorial.TutorialScreen
import androidx.navigation.NavType
```

(`NavType` is already imported — verify; if duplicate, skip.)

### 7b. Splash → destination logic (line 73–79)

Replace the `val destination = when { ... }` block:

```kotlin
                    val destination = when {
                        !appPreferences.isOnboardingCompleted -> Routes.ONBOARDING
                        !appPreferences.isTutorialSeen -> Routes.TUTORIAL
                        !authManager.isLoggedIn -> Routes.LOGIN
                        else -> Routes.MAIN
                    }
```

### 7c. Onboarding → Tutorial (line 91–95)

Change onboarding completion navigation from LOGIN to TUTORIAL:

```kotlin
            OnboardingScreen(
                onComplete = {
                    appPreferences.isOnboardingCompleted = true
                    navController.navigate(Routes.TUTORIAL) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            )
```

### 7d. Add Tutorial composable (after onboarding composable, ~line 98)

```kotlin
        composable(Routes.TUTORIAL) {
            TutorialScreen(
                fromSettings = false,
                onComplete = {
                    appPreferences.isTutorialSeen = true
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.TUTORIAL) { inclusive = true }
                    }
                }
            )
        }
```

### 7e. Add Tutorial route for settings re-view (in `MainNavHost`, after TRASH route, ~line 328)

```kotlin
        composable(
            route = "${Routes.TUTORIAL}?fromSettings={fromSettings}",
            arguments = listOf(
                navArgument("fromSettings") {
                    type = NavType.BoolType
                    defaultValue = false
                }
            ),
            enterTransition = { slideInHorizontally(tween(300)) { it } + fadeIn(tween(300)) },
            exitTransition = { slideOutHorizontally(tween(300)) { it } + fadeOut(tween(300)) }
        ) { backStackEntry ->
            val fromSettings = backStackEntry.arguments?.getBoolean("fromSettings") ?: false
            TutorialScreen(
                fromSettings = fromSettings,
                onComplete = { navController.popBackStack() }
            )
        }
```

**Commit:** `feat(mobile): wire tutorial into navigation flow`

---

## Task 8: Add "사용 안내 다시 보기" to Settings

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/settings/SettingsScreen.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/settings/GeneralScreen.kt`

### 8a. SettingsScreen — pass navController to GeneralScreen

`SettingsScreen.kt` wraps `GeneralScreen`. The inner `MainNavHost` NavController is needed to navigate to the tutorial route. Since `SettingsScreen` is inside `MainNavHost`, we need to get the parent navController.

In `SettingsScreen.kt` (line 26), add parameter:

```kotlin
@Composable
fun SettingsScreen(
    onLogout: () -> Unit = {},
    onNavigateToTutorial: () -> Unit = {}
)
```

Pass it to GeneralScreen (line 82):

```kotlin
3 -> GeneralScreen(onLogout = onLogout, onNavigateToTutorial = onNavigateToTutorial)
```

### 8b. Update MainNavHost to pass onNavigateToTutorial

In `AppNavigation.kt`, `MainNavHost`'s Settings composable (line 316):

```kotlin
composable(
    Screen.Settings.route,
    enterTransition = { fadeIn(tween(200)) },
    exitTransition = { fadeOut(tween(200)) }
) {
    SettingsScreen(
        onLogout = onLogout,
        onNavigateToTutorial = {
            navController.navigate("${Routes.TUTORIAL}?fromSettings=true")
        }
    )
}
```

### 8c. GeneralScreen — add tutorial re-view button

In `GeneralScreen.kt`, add parameter (line 100):

```kotlin
@Composable
fun GeneralScreen(
    viewModel: AppFilterViewModel = hiltViewModel(),
    settingsViewModel: SettingsViewModel = hiltViewModel(),
    onLogout: () -> Unit = {},
    onNavigateToTutorial: () -> Unit = {}
)
```

In the "정보" section group, before "앱 정보" (line 966), add a new SettingsSection:

```kotlin
        // 사용 안내 다시 보기
        SettingsSection(title = "사용 안내") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { onNavigateToTutorial() }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "사용 안내 다시 보기",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "앱의 주요 기능을 다시 확인합니다",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
```

### 8d. Hide bottom bar during tutorial re-view

In `AppNavigation.kt`, `MainScreen` (line 133–139), add tutorial check:

```kotlin
    val isTutorialScreen = currentDestination?.route?.startsWith(Routes.TUTORIAL) == true
    val hideBottomBar = isDetailScreen || isTrashScreen || isAppChatScreen || isTutorialScreen || (isAiChat && imeVisible)
```

**Commit:** `feat(mobile): add tutorial re-view button in settings`

---

## Verification

**Build check:**

```bash
cmd.exe /c "cd /mnt/d/Project/09_NotiFlow/apps/mobile && gradlew.bat :app:assembleDebug"
```

Expected: BUILD SUCCESSFUL

**Manual testing checklist:**
1. 앱 데이터 삭제 → 실행 → SPLASH → ONBOARDING → TUTORIAL (5페이지) → 시작하기 → LOGIN
2. 튜토리얼에서 건너뛰기 → LOGIN으로 바로 이동
3. 앱 재실행 → 튜토리얼 건너뜀 (isTutorialSeen = true)
4. 설정 → 정보 → "사용 안내 다시 보기" → 튜토리얼 표시 → 뒤로가기 → 설정 복귀
5. 다크 모드에서 튜토리얼 가시성 확인
6. 스와이프로 페이지 이동 확인
7. 페이지 인디케이터 애니메이션 확인
