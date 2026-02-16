# 대시보드 최적화 설계 문서

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 업무 효율성 중심의 상용화 수준 대시보드 구현

**Architecture:** 체크박스 기반 빠른 액션 + 시간 기반 자동 긴급도 + 카테고리별 현황 요약

**Tech Stack:** Jetpack Compose, MVVM, Hilt, Room, StateFlow

---

## 1. 전체 레이아웃

```
┌─────────────────────────────────┐
│  컴팩트 통계 바                   │
│  오늘 12  │  미처리 5  │  완료 7  │
├─────────────────────────────────┤
│  🔴 미처리 메시지 (5)             │
│  ☑ [긴급] 메시지 카드 (48시간 전)  │
│  ☐ [주의] 메시지 카드 (26시간 전)  │
│  ☐ 메시지 카드 (2시간 전)         │
│                        더보기 → │
├─────────────────────────────────┤
│  📊 카테고리별 현황               │
│  업무 3건 | 개인 2건 | 미분류 0건  │
├─────────────────────────────────┤
│  ✅ 오늘 완료 (7)                 │
│  ✓ 메시지 카드                   │
│  ✓ 메시지 카드                   │
│                        더보기 → │
└─────────────────────────────────┘
```

**섹션 순서:** 통계 → 미처리 → 카테고리 요약 → 오늘 완료

---

## 2. 컴팩트 통계 바

### 디자인
```
┌─────────────────────────────────────────┐
│   오늘 12    │   미처리 5    │   완료 7   │
│   📥 +3      │   🔴 긴급2    │   ✅ 70%   │
└─────────────────────────────────────────┘
```

### 구성 요소
- **오늘**: 오늘 수신 메시지 수 + 전일 대비 증감 ("+3" / "-2")
- **미처리**: 첫 번째 상태 메시지 수 + 긴급(24시간+) 건수 (빨간색)
- **완료**: 오늘 완료 건수 + 처리율 퍼센트

### 동작
- 각 영역 탭 → 해당 필터로 메시지 탭 이동
- 미처리 숫자 색상: 0=초록, 1+=주황~빨강 그라데이션

### 코드 구조
```kotlin
@Composable
fun CompactStatsBar(
    todayCount: Int,
    todayDelta: Int,        // 전일 대비
    pendingCount: Int,
    urgentCount: Int,       // 24시간+ 미처리
    completedToday: Int,
    completionRate: Int,    // 퍼센트
    onTodayClick: () -> Unit,
    onPendingClick: () -> Unit,
    onCompletedClick: () -> Unit
)
```

---

## 3. 미처리 메시지 섹션

### 긴급도 레벨
| 시간 | 레벨 | 표시 |
|------|------|------|
| 48시간+ | 긴급 | 🔴 빨간 배경 + "긴급" 뱃지 |
| 24~48시간 | 주의 | 🟠 주황 테두리 + "주의" 뱃지 |
| 24시간 미만 | 일반 | 기본 스타일 |

### 카드 디자인
```
┌─ 긴급 ──────────────────────────────┐
│ ☐  홍길동 · 카카오톡        48시간 전 │
│    회의 일정 변경 건 확인 부탁...     │
│    [업무]                           │
└─────────────────────────────────────┘
```

### 체크박스 동작
- **체크** → 다음 상태로 이동 (첫 번째 → 두 번째)
- **길게 누르기** → 상태 선택 드롭다운 (바로 "완료" 가능)
- **완료 시** → 짧은 애니메이션 후 목록에서 제거

### 코드 구조
```kotlin
@Composable
fun PendingMessageCard(
    message: CapturedMessageEntity,
    urgencyLevel: UrgencyLevel,
    categoryName: String?,
    categoryColor: Int?,
    onCheck: () -> Unit,
    onLongPress: () -> Unit,
    onClick: () -> Unit
)

enum class UrgencyLevel { URGENT, WARNING, NORMAL }

fun calculateUrgency(receivedAt: Long): UrgencyLevel {
    val hours = (System.currentTimeMillis() - receivedAt) / (1000 * 60 * 60)
    return when {
        hours >= 48 -> UrgencyLevel.URGENT
        hours >= 24 -> UrgencyLevel.WARNING
        else -> UrgencyLevel.NORMAL
    }
}
```

---

## 4. 카테고리별 현황

### 디자인
```
┌─────────────────────────────────────┐
│  📊 카테고리별 현황                  │
├─────────────────────────────────────┤
│  🔵 업무      ████████░░  8건 (3긴급) │
│  🟢 개인      ███░░░░░░░  3건        │
│  🟡 기타      █░░░░░░░░░  1건        │
│  ⚪ 미분류    ░░░░░░░░░░  0건        │
└─────────────────────────────────────┘
```

### 구성 요소
- 카테고리 색상 점 + 이름
- 미처리 건수 비례 막대 (전체 대비)
- 건수 + 긴급 건수 (빨간색)

### 동작
- 행 탭 → 해당 카테고리 필터로 메시지 탭 이동
- 긴급 건수 있으면 행 강조

### 코드 구조
```kotlin
@Composable
fun CategorySummarySection(
    summaries: List<CategorySummary>,
    onCategoryClick: (Long?) -> Unit
)

data class CategorySummary(
    val categoryId: Long?,
    val name: String,
    val color: Int,
    val pendingCount: Int,
    val urgentCount: Int
)
```

---

## 5. 오늘 완료 섹션

### 디자인
```
┌─────────────────────────────────────┐
│  ✅ 오늘 완료 (7)           더보기 → │
├─────────────────────────────────────┤
│  ✓  홍길동 · 카카오톡      10:30 완료 │
│     회의 일정 확인 완료              │
│     [업무]                          │
└─────────────────────────────────────┘
```

### 구성 요소
- 완료 체크 아이콘 (회색 톤)
- 발신자 · 앱이름 + 완료 시간
- 메시지 내용 (흐린 색상)
- 카테고리 뱃지

### 특징
- 최대 5개 표시 (최근 완료 순)
- 전체 흐린 톤 (완료됨 느낌)
- "더보기" → 완료 상태 필터로 이동

### 코드 구조
```kotlin
@Composable
fun CompletedMessageCard(
    message: CapturedMessageEntity,
    completedAt: Long,
    categoryName: String?,
    categoryColor: Int?,
    onClick: () -> Unit
)
```

---

## 6. ViewModel 변경사항

### 새로 추가할 StateFlow
```kotlin
// 전일 대비 증감
val todayDelta: StateFlow<Int>

// 긴급 메시지 수 (24시간+)
val urgentCount: StateFlow<Int>

// 오늘 완료 건수
val completedTodayCount: StateFlow<Int>

// 처리율 (완료 / (완료+미처리) * 100)
val completionRate: StateFlow<Int>

// 카테고리별 요약
val categorySummaries: StateFlow<List<CategorySummary>>

// 오늘 완료한 메시지 (최대 5개)
val completedTodayMessages: StateFlow<List<CapturedMessageEntity>>
```

### 새로 추가할 함수
```kotlin
// 메시지를 다음 상태로 이동
fun moveToNextStatus(messageId: Long)

// 메시지를 특정 상태로 이동
fun moveToStatus(messageId: Long, statusId: Long)
```

---

## 7. DB 변경사항

### CapturedMessageEntity 필드 추가 (선택)
```kotlin
// 상태 변경 시간 (완료 시간 추적용)
val statusChangedAt: Long? = null
```

### DAO 쿼리 추가
```kotlin
// 오늘 완료된 메시지 (마지막 상태)
@Query("""
    SELECT * FROM captured_messages
    WHERE statusId = :lastStatusId
    AND statusChangedAt >= :todayStart
    ORDER BY statusChangedAt DESC
    LIMIT :limit
""")
fun getCompletedToday(lastStatusId: Long, todayStart: Long, limit: Int): Flow<List<CapturedMessageEntity>>

// 어제 수신 건수 (전일 대비 계산용)
@Query("SELECT COUNT(*) FROM captured_messages WHERE receivedAt >= :start AND receivedAt < :end")
fun getCountBetween(start: Long, end: Long): Flow<Int>
```

---

## 8. 구현 순서

1. **DB 마이그레이션** - statusChangedAt 필드 추가
2. **DAO 쿼리 추가** - 완료 메시지, 어제 건수
3. **ViewModel 확장** - 새 StateFlow 추가
4. **CompactStatsBar** - 통계 바 컴포넌트
5. **PendingMessageCard** - 체크박스 + 긴급도 카드
6. **CategorySummarySection** - 카테고리 요약
7. **CompletedMessageCard** - 완료 메시지 카드
8. **DashboardScreen 통합** - 전체 조립
