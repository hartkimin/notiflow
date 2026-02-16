# MedNotiV2 상용 앱 고도화 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** MedNotiV2를 상용 앱 수준으로 고도화 - 온보딩, 안정성, UI/UX 디테일, 핵심 기능 추가

**Architecture:** 기존 MVVM + Hilt + Room + Compose 아키텍처를 유지하면서 점진적으로 개선. 새로운 라이브러리 의존성 최소화.

**Tech Stack:** Kotlin, Jetpack Compose (Material3), Room, Hilt, Navigation Compose

---

## Phase 1: 스플래시 & 온보딩

### Task 1: 스플래시 화면 추가

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/splash/SplashScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/navigation/AppNavigation.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/navigation/Screen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/preferences/AppPreferences.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/MainActivity.kt`

**What to build:**
- `SplashScreen` composable: 앱 아이콘 + "MedNoti" 텍스트가 페이드인 (0.8초)
- `AppPreferences`에 `isOnboardingCompleted: Boolean` 추가 (SharedPreferences)
- `MainActivity`에서 `PermissionHandler`를 온보딩 플로우 안으로 이동
- `AppNavigation`에서 startDestination을 `splash`로 변경
- 스플래시 완료 후: 온보딩 미완료 → 온보딩 화면, 완료 → 메인 화면으로 분기

**Implementation details:**
```kotlin
// SplashScreen.kt
@Composable
fun SplashScreen(onFinished: (isOnboardingDone: Boolean) -> Unit) {
    val alpha = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        alpha.animateTo(1f, animationSpec = tween(800))
        delay(200)
        onFinished(/* check AppPreferences */)
    }
    // 중앙에 로고 + 앱 이름 표시
}
```

**Commit:** `feat: 스플래시 화면 및 온보딩 분기 추가`

---

### Task 2: 온보딩 플로우 (3페이지 + 권한 설정 통합)

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/onboarding/OnboardingScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/navigation/AppNavigation.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/navigation/Screen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/preferences/AppPreferences.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/MainActivity.kt`

**What to build:**
- 3페이지 HorizontalPager 온보딩:
  - Page 1: 앱 소개 - "알림을 자동으로 캡처하고 업무로 관리하세요" + 아이콘 3개 (알림캡처, 자동분류, 상태추적)
  - Page 2: 권한 설정 - 기존 `PermissionHandler` 로직을 여기에 통합. 알림 접근/SMS/알림 권한을 카드 형태로 단계별 설정
  - Page 3: "준비 완료!" + "시작하기" 버튼
- 하단에 페이지 인디케이터 (dot indicator)
- "건너뛰기" 버튼 (Page 1, 2에만)
- `PermissionHandler`는 온보딩 완료 후에는 더 이상 블로킹하지 않도록 변경 (대신 설정 화면에서 권한 상태 배너로 안내)
- `isOnboardingCompleted = true` 저장 후 메인 화면으로 이동

**Commit:** `feat: 온보딩 플로우 3페이지 구현`

---

### Task 3: 권한 미설정 시 안내 배너

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/components/PermissionBanner.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/MainActivity.kt`

**What to build:**
- 온보딩 완료 후에도 권한이 꺼져있으면 메시지 목록 상단에 경고 배너 표시
- "알림 접근 권한이 비활성화되어 있습니다. 활성화하기" 형태
- 탭하면 시스템 설정으로 이동
- 닫기(X) 버튼으로 숨기기 가능 (세션 동안만)
- `MainActivity`에서 `PermissionHandler` wrapper를 제거하고, 온보딩 완료 시 바로 `AppNavigation` 표시

**Commit:** `feat: 권한 미설정 안내 배너 추가`

---

## Phase 2: 안정성 & 에러 처리

### Task 4: 데이터베이스 마이그레이션 안정화

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/di/DatabaseModule.kt`

**What to build:**
- `fallbackToDestructiveMigrationFrom(1, 2, 3)` 제거
- 기존 v1→v4 사용자를 위한 빈 마이그레이션 추가 (또는 유지하되 주석으로 이유 명시)
- 현재 v5이므로 앞으로는 정식 마이그레이션만 사용
- 실질적으로 신규 설치가 대부분이므로 `fallbackToDestructiveMigrationFrom(1, 2, 3)`은 유지하되 4→5 이후는 정식 마이그레이션만 사용하도록 주석 정리

**Commit:** `fix: DB 마이그레이션 전략 정리`

---

### Task 5: 입력 검증 추가

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/filter/CategoryEditDialog.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/status/StatusStepEditDialog.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/filter/FilterRuleEditDialog.kt`

**What to build:**
- 카테고리 이름: 빈 문자열 체크, 30자 제한, 중복 이름 체크
- 상태 단계 이름: 빈 문자열 체크, 20자 제한, 중복 이름 체크
- 필터 규칙: 발신자 키워드나 포함 키워드 중 하나는 반드시 입력
- 에러 시 TextField 아래에 빨간색 에러 메시지 표시 (`isError` + `supportingText`)
- "저장" 버튼은 에러가 있으면 비활성화

**Commit:** `fix: 입력 검증 및 에러 표시 추가`

---

### Task 6: NotificationListenerService 안정성 강화

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/service/notification/MedNotiListenerService.kt`

**What to build:**
- `onNotificationPosted`에서 extras 파싱 실패 시 graceful return (try-catch 추가)
- `resolveAppName` 실패 시 packageName 반환 (이미 되어있으나 로그 수준 조정)
- `processMessage` 내부 DB 작업 실패 시 로그만 남기고 크래시 방지 (이미 SupervisorJob으로 되어있지만 개별 launch에도 try-catch)
- scope 재생성 로직 검증 및 정리

**Commit:** `fix: 알림 리스너 서비스 안정성 강화`

---

## Phase 3: UI/UX 완성도

### Task 7: 각 화면 빈 상태(Empty State) 개선

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/components/EmptyState.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/calendar/CalendarScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/kanban/KanbanScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/filter/FilterScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/status/StatusScreen.kt`

**What to build:**
- 재사용 가능한 `EmptyState` composable:
```kotlin
@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    description: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
)
```
- 메시지 목록 빈 상태: 메시지 아이콘 + "수집된 알림이 없습니다" + "설정에서 앱을 선택하면 알림이 자동 수집됩니다" + "설정으로 이동" 버튼
- 캘린더 빈 상태: 선택한 날짜에 메시지가 없을 때 "이 날짜에 수집된 알림이 없습니다"
- 칸반 빈 상태: "상태 단계를 설정하고 알림을 관리하세요" + "설정으로 이동"
- 필터 카테고리 없을 때: "카테고리를 추가하면 알림이 자동으로 분류됩니다" + "추가하기"
- 상태 단계 없을 때: "상태 단계를 추가하면 알림 처리 흐름을 관리할 수 있습니다" + "추가하기"

**Commit:** `feat: 각 화면 빈 상태 UI 개선`

---

### Task 8: Snackbar 피드백 시스템

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/navigation/AppNavigation.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageDetailScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/filter/FilterScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/status/StatusScreen.kt`

**What to build:**
- `AppNavigation`의 `Scaffold`에 `SnackbarHost` 추가
- `SnackbarHostState`를 CompositionLocal로 하위 화면에 전달
- 적용할 액션들:
  - 메시지 삭제 시: "메시지가 삭제되었습니다" + "되돌리기" 액션
  - 메시지 상태 변경 시: "상태가 '확인'으로 변경되었습니다"
  - 카테고리 저장/삭제 시: "카테고리가 저장되었습니다" / "삭제되었습니다"
  - 상태 단계 저장/삭제 시: "상태 단계가 저장되었습니다"
  - 코멘트 저장 시: "코멘트가 저장되었습니다"
- 삭제 되돌리기: 삭제 전 메시지를 임시 보관, Snackbar의 "되돌리기" 클릭 시 재삽입

**Commit:** `feat: Snackbar 피드백 및 삭제 되돌리기 추가`

---

### Task 9: 확인 다이얼로그 통일

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/components/ConfirmDialog.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/filter/FilterScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/status/StatusScreen.kt`

**What to build:**
- 재사용 가능한 `ConfirmDialog` composable:
```kotlin
@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmText: String = "삭제",
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
)
```
- 카테고리 삭제 시: "이 카테고리를 삭제하면 관련된 필터 규칙도 함께 삭제됩니다. 계속하시겠습니까?"
- 상태 단계 삭제 시: "이 상태 단계를 삭제하시겠습니까?"
- 기존 `MessageDetailScreen`의 삭제 다이얼로그를 `ConfirmDialog`로 교체

**Commit:** `feat: 확인 다이얼로그 통일`

---

### Task 10: 화면 전환 애니메이션

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/navigation/AppNavigation.kt`

**What to build:**
- NavHost의 `composable` 블록에 `enterTransition`, `exitTransition` 추가
- 탭 전환: 페이드 트랜지션 (200ms)
- 상세 화면 진입: 오른쪽에서 슬라이드인 (300ms)
- 상세 화면 이탈: 오른쪽으로 슬라이드아웃 (300ms)
```kotlin
composable(
    route = "message_detail/{messageId}",
    enterTransition = { slideInHorizontally(initialOffsetX = { it }) + fadeIn() },
    exitTransition = { slideOutHorizontally(targetOffsetX = { it }) + fadeOut() },
    ...
)
```

**Commit:** `feat: 화면 전환 애니메이션 추가`

---

### Task 11: 메시지 카드 스와이프 제스처

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageCard.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/viewmodel/MessageViewModel.kt`

**What to build:**
- `SwipeToDismissBox` (Material3) 사용
- 왼쪽 스와이프 → 빨간 배경 + 삭제 아이콘 → 삭제 (Snackbar 되돌리기 포함)
- 오른쪽 스와이프 → 초록 배경 + 체크 아이콘 → 다음 상태로 이동
- ViewModel에 `moveToNextStatus(messageId: Long)` 함수 추가 - 현재 상태의 다음 orderIndex 상태로 변경

**Commit:** `feat: 메시지 카드 스와이프 제스처 추가`

---

### Task 12: 앱바 메시지 카운트 배지 & 검색 하이라이트

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageCard.kt`

**What to build:**
- 메시지 목록 TopAppBar 제목 옆에 총 메시지 수 표시: "알림 (42)"
- 검색 중일 때 필터된 수 표시: "알림 (12/42)"
- 검색 하이라이트: 검색 키워드와 일치하는 부분을 `AnnotatedString`으로 하이라이트 (배경색 강조)
- MessageCard에 `searchQuery` 파라미터 추가하여 sender, content에서 일치 부분 표시

**Commit:** `feat: 메시지 카운트 배지 및 검색 하이라이트`

---

## Phase 4: 상용 필수 기능

### Task 13: 정렬 옵션

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/viewmodel/MessageViewModel.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/db/dao/CapturedMessageDao.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/repository/MessageRepository.kt`

**What to build:**
- 검색바 우측에 정렬 아이콘 버튼 추가
- 클릭 시 DropdownMenu: 최신순(기본), 오래된순, 발신자순, 앱별
- ViewModel에 `sortOrder: StateFlow<SortOrder>` 추가
- Enum: `SortOrder { NEWEST, OLDEST, BY_SENDER, BY_APP }`
- 정렬은 클라이언트 사이드에서 처리 (이미 Flow로 전체 데이터를 받고 있으므로)

**Commit:** `feat: 메시지 정렬 옵션 추가`

---

### Task 14: 다중 선택 & 일괄 작업

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageCard.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/viewmodel/MessageViewModel.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/db/dao/CapturedMessageDao.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/repository/MessageRepository.kt`

**What to build:**
- 메시지 카드 길게 눌러서 선택 모드 진입
- 선택 모드: 카드 좌측에 체크박스 표시, 상단 앱바가 "N개 선택됨"으로 변경
- 선택 모드 앱바 액션: "전체선택", "상태변경" (DropdownMenu로 상태 목록), "삭제"
- DAO에 `deleteByIds(ids: List<Long>)`, `updateStatusByIds(ids: List<Long>, statusId: Long)` 추가
- 뒤로가기 또는 빈 곳 탭으로 선택 모드 해제

**Commit:** `feat: 다중 선택 및 일괄 작업 추가`

---

### Task 15: 메시지 보관(아카이브) 기능

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/db/entity/CapturedMessageEntity.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/db/AppDatabase.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/di/DatabaseModule.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/db/dao/CapturedMessageDao.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/repository/MessageRepository.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/viewmodel/MessageViewModel.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`

**What to build:**
- `CapturedMessageEntity`에 `isArchived: Boolean = false` 필드 추가
- DB 마이그레이션 v5→v6: `ALTER TABLE captured_messages ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0`
- `AppDatabase` version 6으로 업그레이드
- DAO 쿼리 수정: 기본 목록에서 `isArchived = 0`인 것만 표시
- 메시지 필터 칩에 "보관함" 칩 추가 (선택 시 isArchived = 1인 것만 표시)
- 스와이프 왼쪽 또는 상세에서 "보관" 액션 추가
- 보관함에서 "보관 해제" 가능

**Commit:** `feat: 메시지 보관(아카이브) 기능 추가`

---

### Task 16: 통계 대시보드

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageStatsCard.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/viewmodel/MessageViewModel.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/db/dao/CapturedMessageDao.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/repository/MessageRepository.kt`

**What to build:**
- 메시지 목록 상단 (검색바 위)에 접이식 통계 카드
- 3개 수치 가로 배치:
  - "오늘 수신" (오늘 0시~현재 사이 receivedAt)
  - "미처리" (statusId가 첫 번째 상태인 메시지 수)
  - "완료" (statusId가 마지막 상태인 메시지 수)
- DAO에 `getTodayCount()`, `getCountByStatus(statusId)` 추가
- 카드 우측 상단에 접기/펼치기 토글 (화살표 아이콘)
- 접은 상태는 `AppPreferences`에 저장

**Commit:** `feat: 메시지 목록 상단 통계 대시보드 추가`

---

### Task 17: 캡처 알림 (Notification)

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/service/notification/CaptureNotificationHelper.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/service/notification/MedNotiListenerService.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/service/notification/SmsReceiver.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/preferences/AppPreferences.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/settings/GeneralScreen.kt`
- Modify: `app/src/main/res/AndroidManifest.xml` (if needed)

**What to build:**
- `CaptureNotificationHelper`: NotificationChannel 생성 + 알림 표시 유틸리티
  - 채널 ID: "capture_alerts"
  - 알림 내용: "[앱이름] 발신자: 내용 미리보기"
  - 탭하면 메시지 상세 화면으로 이동 (PendingIntent + deep link)
- `MedNotiListenerService.processMessage()`와 `SmsReceiver`에서 메시지 저장 후 알림 표시
- `AppPreferences`에 `captureNotificationEnabled: Boolean` 추가
- `GeneralScreen`에 "캡처 알림" ON/OFF 스위치 추가
- 알림은 자기 자신이 보낸 알림을 다시 캡처하지 않도록 주의 (이미 자기 packageName 필터링 있음)

**Commit:** `feat: 새 메시지 캡처 시 상태바 알림 표시`

---

### Task 18: 데이터 백업/복원

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/data/backup/BackupManager.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/settings/BackupRestoreSection.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/settings/GeneralScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/di/DatabaseModule.kt`

**What to build:**
- `BackupManager` (@Singleton, Hilt 주입):
  - `exportToJson(): String` - 모든 테이블 데이터를 JSON으로 직렬화
    - categories, filter_rules, status_steps, captured_messages, app_filters
    - 메타데이터: 앱 버전, 백업 시각, DB 버전
  - `importFromJson(json: String, mode: RestoreMode)` - JSON에서 복원
    - `RestoreMode.OVERWRITE`: 기존 데이터 삭제 후 복원
    - `RestoreMode.MERGE`: 기존 데이터 유지, 새 데이터 추가
- `BackupRestoreSection` composable:
  - "데이터 내보내기" 버튼 → SAF(Storage Access Framework)로 JSON 파일 저장
  - "데이터 복원" 버튼 → SAF로 JSON 파일 선택 → 모드 선택 다이얼로그 → 복원
  - 복원 전 확인 다이얼로그: "기존 데이터를 덮어쓰시겠습니까?"
- `GeneralScreen`에 백업/복원 섹션 추가

**Commit:** `feat: 데이터 백업/복원 기능 추가`

---

### Task 19: 자동 삭제 설정

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/preferences/AppPreferences.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/settings/GeneralScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/db/dao/CapturedMessageDao.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/data/repository/MessageRepository.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/service/notification/MedNotiListenerService.kt`

**What to build:**
- `AppPreferences`에 `autoDeleteDays: Int` 추가 (0 = 비활성, 30, 60, 90)
- `GeneralScreen`에 "자동 삭제" 섹션: SegmentedSelector로 "사용안함 / 30일 / 60일 / 90일"
- DAO에 `deleteOlderThan(timestamp: Long)` 쿼리 추가
- `MedNotiListenerService.onListenerConnected()`에서 자동 삭제 실행 (앱이 활성화될 때마다 오래된 메시지 정리)
- 보관된 메시지(isArchived=true)는 자동 삭제 대상에서 제외

**Commit:** `feat: 오래된 메시지 자동 삭제 설정 추가`

---

### Task 20: 설정 화면 정보 보강 및 최종 마무리

**Files:**
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/settings/GeneralScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/app/build.gradle.kts`

**What to build:**
- `GeneralScreen` 하단에 앱 정보 섹션:
  - 앱 버전 (BuildConfig에서 가져오기)
  - "MedNoti - 알림을 업무로 관리하세요"
  - 오픈소스 라이선스 (간단히 텍스트로)
- `build.gradle.kts`에 `buildFeatures { buildConfig = true }` 추가
- 릴리즈 빌드 설정: `isMinifyEnabled = true`, ProGuard 규칙 정리
- versionName을 "2.0.0"으로 업그레이드

**Commit:** `feat: 앱 정보 및 릴리즈 빌드 설정 정리`
