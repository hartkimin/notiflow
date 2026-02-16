# MedNotiV2 - 업무 메시지 관리 앱 설계

## 개요

카카오톡/SMS에서 수신되는 업무 메시지를 자동으로 선별하고, 상태를 추적하며, 캘린더에서 현황을 확인할 수 있는 Android 앱.

## 아키텍처

- **패턴:** MVVM + Clean Architecture (간소화)
- **UI:** Jetpack Compose + Material3
- **로컬 DB:** Room + KSP
- **DI:** Hilt
- **비동기:** Kotlin Coroutines + Flow
- **네비게이션:** Navigation Compose

```
┌──────────────────────────────────────┐
│            UI Layer (Compose)         │
│  ┌──────┐ ┌──────┐ ┌──────────────┐  │
│  │메시지│ │필터  │ │  캘린더/통계  │  │
│  │목록  │ │설정  │ │              │  │
│  └──────┘ └──────┘ └──────────────┘  │
├──────────────────────────────────────┤
│          ViewModel Layer              │
├──────────────────────────────────────┤
│        Repository Layer               │
├──────────────────────────────────────┤
│    Room DB         │  Service Layer   │
│  (로컬 저장소)      │  (알림 수집)     │
└──────────────────────────────────────┘
```

## 데이터 모델

### Category (카테고리)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | Long (PK) | 자동 생성 |
| name | String | 카테고리 이름 ("거래처A", "배송 관련") |
| color | Int | 구분용 색상 |
| createdAt | Long | 생성 시각 |

### FilterRule (필터링 규칙)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | Long (PK) | 자동 생성 |
| categoryId | Long (FK) | 소속 카테고리 |
| source | Enum | KAKAO, SMS, ALL |
| senderKeyword | String? | 보내는 사람 이름 (null이면 전체) |
| includeWords | List<String> | 포함해야 할 키워드들 |
| excludeWords | List<String> | 제외할 키워드들 |
| isActive | Boolean | 활성 여부 |
| createdAt | Long | 생성 시각 |

### CapturedMessage (수집된 메시지)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | Long (PK) | 자동 생성 |
| categoryId | Long (FK) | 카테고리 |
| matchedRuleId | Long (FK) | 매칭된 필터 규칙 |
| source | Enum | KAKAO, SMS |
| sender | String | 보낸 사람 |
| content | String | 메시지 내용 |
| statusId | Long (FK) | 현재 상태 |
| receivedAt | Long | 수신 시각 |
| updatedAt | Long | 최종 수정 시각 |

### StatusStep (사용자 정의 상태 단계)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | Long (PK) | 자동 생성 |
| categoryId | Long (FK) | 소속 카테고리 |
| name | String | 상태 이름 ("신규", "확인", "완료") |
| orderIndex | Int | 정렬 순서 |
| color | Int | 상태 표시 색상 |

### 관계
- Category 1 → N FilterRule
- Category 1 → N StatusStep
- Category 1 → N CapturedMessage
- FilterRule → CapturedMessage (매칭 규칙)
- StatusStep → CapturedMessage (현재 상태)

## 알림 수집 흐름

```
알림 수신 (NotificationListenerService)
    │
    ├─ 패키지 확인
    │   ├─ com.kakao.talk → KAKAO
    │   └─ SMS 앱 패키지 → SMS (+ BroadcastReceiver 병행)
    │
    ├─ 알림 데이터 추출
    │   ├─ sender: 알림 title/ticker에서 추출
    │   └─ content: 알림 text에서 추출
    │
    ├─ 필터 규칙 매칭 (활성화된 규칙만)
    │   ├─ source 일치
    │   ├─ senderKeyword 매칭
    │   ├─ includeWords 포함 확인
    │   └─ excludeWords 제외 확인
    │
    ├─ 매칭 성공 → CapturedMessage 생성 + 저장
    └─ 매칭 실패 → 무시
```

### 필요 권한
- `BIND_NOTIFICATION_LISTENER_SERVICE` — 알림 접근
- `RECEIVE_SMS`, `READ_SMS` — SMS 수신/읽기
- `POST_NOTIFICATIONS` — 앱 자체 알림 (Android 13+)

## UI 화면 구성

### 하단 네비게이션 4탭

#### 탭 1: 메시지 목록 (메인)
- 카테고리별 필터링 칩 (상단)
- 상태별 필터링 칩 (상단 하위)
- 메시지 카드 리스트 (발신자, 카테고리, 시각, 내용 미리보기, 상태 배지)
- 메시지 탭 → 상세 보기 + 상태 변경 이력
- 스와이프로 빠른 상태 변경/삭제

#### 탭 2: 캘린더
- 월별 캘린더 뷰 (날짜에 카테고리별 색상 점)
- 날짜 탭 → 해당일 메시지 목록
- 하단에 상태별 건수 통계 바

#### 탭 3: 필터 설정
- 카테고리 목록 (추가/수정/삭제)
- 카테고리 탭 → 필터 규칙 목록
- 필터 규칙 편집 (소스, 발신자, 포함/제외 키워드, 활성 토글)

#### 탭 4: 상태 관리
- 카테고리 선택 드롭다운
- 상태 단계 목록 (드래그 순서 변경)
- 상태 추가/수정/삭제 + 색상 선택

## 패키지 구조

```
com.nopti.mednotiv2/
├── data/
│   ├── db/           # Room DB, Entity, DAO
│   ├── model/        # 도메인 모델
│   └── repository/   # Repository 구현
├── service/
│   └── notification/ # NotificationListenerService, SMS Receiver
├── ui/
│   ├── navigation/   # NavHost, 하단 네비게이션
│   ├── message/      # 메시지 목록/상세 화면
│   ├── calendar/     # 캘린더 뷰
│   ├── filter/       # 필터 규칙 설정
│   ├── status/       # 상태 단계 관리
│   └── components/   # 공유 UI 컴포넌트
├── viewmodel/        # ViewModel들
├── di/               # Hilt 모듈
└── util/             # 유틸리티
```

## 구현 우선순위

1. 데이터 레이어 (Room DB + Entity + DAO + Repository)
2. NotificationListenerService + 필터 엔진
3. 메시지 목록 화면 + 상태 변경
4. 필터/카테고리 설정 화면
5. 상태 단계 관리 화면
6. 캘린더 뷰 + 통계

## 확장 계획 (앱 완성 후)

- 웹페이지를 통한 팀 공유 기능
- 클라우드 동기화 (Repository 패턴으로 확장 용이)
