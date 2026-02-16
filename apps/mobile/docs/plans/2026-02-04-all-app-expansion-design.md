# MedNotiV2 전체 앱 확대 설계

## 목표

카카오톡 + SMS 전용 앱을 **모든 앱 알림을 캡처**하는 범용 알림 관리 앱으로 확대한다.

## 핵심 변경

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 알림 소스 | KakaoTalk + SMS | 모든 앱 + SMS |
| 앱 필터 | 없음 (하드코딩) | 화이트리스트/블랙리스트 선택 |
| 키워드 필터 | 카테고리 종속 | 2단계 분리 (앱 필터 → 키워드 필터) |
| 미매칭 메시지 | 버림 | 미분류로 저장 |
| 상태 변경 | 상세 화면에서만 | 메시지 카드에서 직접 |
| MessageSource | enum (KAKAO, SMS, ALL) | String (패키지명 or "SMS") |

---

## 아키텍처

### 알림 캡처 파이프라인

```
알림 수신 (NotificationListenerService / SmsReceiver)
    │
    ▼
[1단계: 앱 필터]
    │  - 화이트리스트: app_filters에 있고 isAllowed=true인 앱만 통과
    │  - 블랙리스트: app_filters에 있고 isAllowed=true인 앱은 차단
    │  - SMS: 별도 ON/OFF 설정
    │
    ▼ (통과)
[2단계: 키워드 필터 매칭]
    │  - 활성 FilterRule 순회
    │  - sender 매칭 (CONTAINS/EXACT)
    │  - include words (AND/OR)
    │  - exclude words
    │
    ├── 매칭됨 → categoryId 할당 + 첫 상태 할당 → DB 저장
    └── 미매칭 → categoryId=null (미분류) + 첫 상태 할당 → DB 저장
```

---

## 데이터 모델 변경

### 1. MessageSource 제거

```kotlin
// 삭제: enum class MessageSource { KAKAO, SMS, ALL }
// 삭제: data/model/MessageSource.kt

// CapturedMessageEntity 변경:
//   source: MessageSource → source: String (패키지명 or "SMS")
//   appName: String 추가 (UI 표시용)

// FilterRuleEntity 변경:
//   source: MessageSource → 삭제 (앱 필터가 1단계에서 처리)
//   senderMatchType, smsPhoneNumber 유지
```

### 2. 신규: AppFilterEntity

```kotlin
@Entity(tableName = "app_filters")
data class AppFilterEntity(
    @PrimaryKey val packageName: String,
    val appName: String,
    val isAllowed: Boolean = true
)
```

### 3. 앱 필터 모드 (SharedPreferences)

```kotlin
enum class AppFilterMode { WHITELIST, BLACKLIST }
// key: "app_filter_mode", default: WHITELIST
// key: "sms_capture_enabled", default: true
```

### 4. CapturedMessageEntity 변경

```kotlin
data class CapturedMessageEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val categoryId: Long?,          // nullable (미분류 허용)
    val matchedRuleId: Long?,
    val source: String,             // 패키지명 or "SMS"
    val appName: String,            // UI 표시용 앱 이름
    val sender: String,
    val content: String,
    val statusId: Long?,
    val receivedAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
```

- categoryId FK: onDelete = SET_NULL
- matchedRuleId FK: onDelete = SET_NULL

### 5. FilterRuleEntity 변경

```kotlin
data class FilterRuleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val categoryId: Long,
    // source 삭제
    val senderKeyword: String?,
    val senderMatchType: SenderMatchType = SenderMatchType.CONTAINS,
    val smsPhoneNumber: String? = null,
    val includeWords: List<String>,
    val excludeWords: List<String>,
    val includeMatchType: KeywordMatchType = KeywordMatchType.OR,
    val isActive: Boolean = true,
    val createdAt: Long = System.currentTimeMillis()
)
```

### 6. DB 버전

- version 3 → 4
- fallbackToDestructiveMigration() 사용 중이므로 자동 재생성

---

## UI 변경

### 설정 탭 구조 (2개 서브탭 유지)

```
설정 탭
├── 필터 서브탭
│   ├── [상단] 앱 필터 영역
│   │   ├── 모드 토글: 화이트리스트 / 블랙리스트
│   │   ├── SMS 수신 ON/OFF 스위치
│   │   └── "앱 선택" 버튼 → 선택된 앱 개수 표시
│   │       └── 탭 시 → 설치된 앱 목록 다이얼로그
│   │           ├── 검색 바
│   │           └── 체크박스 앱 목록
│   ├── [구분선]
│   └── [하단] 카테고리 + 키워드 필터 규칙 (기존)
│       - source 드롭다운 제거
│       - 나머지 유지
│
└── 상태 서브탭 (기존 그대로)
```

### 메시지 카드 상태 변경

```
MessageCard
├── [기존] 소스 아이콘 + 발신자 + 내용 미리보기
├── [기존] 카테고리 태그 + 상태 뱃지
└── [변경] 상태 뱃지를 탭 가능하게
    └── 탭 → DropdownMenu로 상태 목록 표시
        └── 선택 → 즉시 상태 변경
```

- 앱 아이콘: source 패키지명으로 앱 아이콘 로드
- SMS: SMS 아이콘 표시
- 미분류 메시지: "미분류" 태그 표시

### FilterRuleEditDialog 변경

- 소스 드롭다운 (카카오톡/SMS/전체) 제거
- smsPhoneNumber 필드: SMS 전용이므로 유지하되 설명 텍스트 변경
- 나머지 유지

---

## 변경 파일 목록

### 삭제
- `data/model/MessageSource.kt`

### 신규
- `data/db/entity/AppFilterEntity.kt`
- `data/db/dao/AppFilterDao.kt`
- `data/repository/AppFilterRepository.kt`
- `data/model/AppFilterMode.kt`
- `data/preferences/AppPreferences.kt` (SharedPreferences wrapper)
- `ui/filter/AppFilterSection.kt` (앱 필터 UI 컴포넌트)
- `ui/filter/AppSelectorDialog.kt` (앱 선택 다이얼로그)
- `di/PreferencesModule.kt`

### 수정
- `data/db/entity/CapturedMessageEntity.kt` — source 타입 변경, appName 추가, categoryId nullable
- `data/db/entity/FilterRuleEntity.kt` — source 필드 삭제
- `data/db/Converters.kt` — MessageSource converter 삭제, SenderMatchType/KeywordMatchType 유지
- `data/db/AppDatabase.kt` — version 4, AppFilterEntity 추가
- `data/db/dao/CapturedMessageDao.kt` — 미분류 쿼리 추가
- `di/DatabaseModule.kt` — AppFilterDao provide 추가
- `service/notification/MedNotiListenerService.kt` — 전체 앱 캡처 + 앱 필터 확인
- `service/notification/SmsReceiver.kt` — SMS ON/OFF 확인
- `service/notification/MessageFilterEngine.kt` — source 매칭 제거, 미매칭 시 null 반환 처리
- `viewmodel/FilterViewModel.kt` — addRule에서 source 파라미터 삭제
- `viewmodel/MessageViewModel.kt` — 미분류 필터 지원
- `viewmodel/KanbanViewModel.kt` — 미분류 지원
- `ui/filter/FilterScreen.kt` — 상단에 앱 필터 영역 추가, 규칙 표시에서 source 제거
- `ui/filter/FilterRuleEditDialog.kt` — source 드롭다운 삭제
- `ui/message/MessageCard.kt` — 상태 뱃지 탭 → 드롭다운, 앱 아이콘 표시
- `ui/message/MessageListScreen.kt` — source 아이콘 변경
- `ui/message/MessageDetailScreen.kt` — source 표시 변경
- `ui/kanban/KanbanScreen.kt` — source 아이콘 변경
- `ui/calendar/CalendarScreen.kt` — 미분류 메시지 지원
