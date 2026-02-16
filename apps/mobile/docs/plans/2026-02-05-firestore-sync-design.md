# Firestore 실시간 동기화 설계

## 개요

NotiMgmt 앱의 모든 데이터를 Firestore와 실시간 동기화하여 여러 기기에서 동시 사용 가능하게 합니다.

## 요구사항

- **동기화 범위**: 전체 데이터 (메시지, 카테고리, 필터규칙, 상태단계, 앱필터)
- **동기화 방식**: 실시간 동기화 (여러 기기 지원)
- **충돌 해결**: Last Write Wins (최신 데이터 우선)

## 아키텍처

### Firestore 데이터 구조

```
users/{userId}/
  ├── categories/{categoryId}
  ├── filterRules/{ruleId}
  ├── statusSteps/{stepId}
  ├── appFilters/{filterId}
  └── messages/{messageId}
```

각 사용자의 데이터는 `users/{userId}` 아래에 컬렉션으로 분리됩니다.

### 동기화 전략

- **Room DB** = 로컬 캐시 (오프라인 지원, 빠른 읽기)
- **Firestore** = 원본 데이터 (실시간 동기화)
- 앱 시작 시 Firestore 리스너 등록 → 변경 감지 → Room 업데이트
- 로컬 변경 시 → Room 저장 → Firestore 업로드

## 데이터 모델 변환

### ID 체계 변경

Room의 `autoGenerate` Long ID → UUID String으로 변경

```kotlin
// Before
@PrimaryKey(autoGenerate = true) val id: Long = 0

// After
@PrimaryKey val id: String = UUID.randomUUID().toString()
```

### Firestore 문서 구조

```json
// categories/{categoryId}
{
  "id": "uuid-string",
  "name": "병원",
  "color": -16776961,
  "createdAt": 1707123456789,
  "updatedAt": 1707123456789
}

// messages/{messageId}
{
  "id": "uuid-string",
  "categoryId": "category-uuid",
  "sender": "서울대병원",
  "content": "예약 알림...",
  "statusId": "status-uuid",
  "updatedAt": 1707123456789,
  ...
}
```

## 동기화 레이어 구조

```
ViewModel
    ↓
Repository (기존)
    ↓
┌─────────────────────────────────┐
│      SyncManager (새로 추가)      │
│  - 로컬/원격 데이터 조율           │
│  - 충돌 해결 (Last Write Wins)    │
└─────────────────────────────────┘
    ↓                    ↓
Room DAO            FirestoreDataSource
(로컬 저장)            (원격 저장)
```

### SyncManager 역할

1. **쓰기**: 로컬 저장 → Firestore 업로드 (비동기)
2. **읽기**: Room에서 읽기 (빠른 응답)
3. **리스너**: Firestore 변경 감지 → Room 업데이트

## 실시간 동기화 흐름

### 앱 시작 시 초기화

1. 로그인 확인
2. Firestore 리스너 등록 (5개 컬렉션)
3. 초기 데이터 로드 → Room에 저장
4. UI는 Room Flow를 관찰

### 실시간 리스너

```kotlin
messagesCollection().addSnapshotListener { snapshot, error ->
    snapshot?.documentChanges?.forEach { change ->
        when (change.type) {
            ADDED, MODIFIED -> {
                val remote = change.document.toMessage()
                val local = roomDao.getById(remote.id)

                // Last Write Wins 적용
                if (local == null || remote.updatedAt > local.updatedAt) {
                    roomDao.upsert(remote)
                }
            }
            REMOVED -> roomDao.deleteById(change.document.id)
        }
    }
}
```

### 로컬 변경 시

```kotlin
suspend fun saveMessage(message: Message) {
    val entity = message.copy(updatedAt = System.currentTimeMillis())
    roomDao.upsert(entity)                    // 1. 로컬 저장 (즉시)
    firestoreDataSource.upsert(entity)        // 2. 원격 저장 (비동기)
}
```

### 삭제 처리

- 실제 삭제 대신 `isDeleted = true` 소프트 삭제
- 동기화 후 30일 지난 삭제 데이터 정리

## 구현 파일 목록

### 새로 생성할 파일

```
data/
├── firestore/
│   ├── FirestoreDataSource.kt      # Firestore CRUD 작업
│   ├── FirestoreCollections.kt     # 컬렉션 경로 상수
│   └── dto/                        # Firestore 문서 DTO
│       ├── MessageDto.kt
│       ├── CategoryDto.kt
│       ├── FilterRuleDto.kt
│       ├── StatusStepDto.kt
│       └── AppFilterDto.kt
├── sync/
│   ├── SyncManager.kt              # 동기화 조율
│   ├── SyncStatus.kt               # 동기화 상태 enum
│   └── CollectionSyncer.kt         # 컬렉션별 동기화 로직
```

### 수정할 파일

```
data/db/entity/
├── CapturedMessageEntity.kt    # id: Long → String (UUID)
├── CategoryEntity.kt           # id: Long → String, updatedAt 추가
├── FilterRuleEntity.kt         # id: Long → String, updatedAt 추가
├── StatusStepEntity.kt         # id: Long → String, updatedAt 추가
└── AppFilterEntity.kt          # id: Long → String, updatedAt 추가

data/repository/
├── MessageRepository.kt        # SyncManager 연동
├── CategoryRepository.kt       # SyncManager 연동
└── ... (기타 Repository)

di/
└── FirestoreModule.kt          # Hilt 모듈 추가

build.gradle.kts                # Firestore 의존성 추가
```

## 의존성 추가

```kotlin
// build.gradle.kts
implementation("com.google.firebase:firebase-firestore")
```

## 오프라인 지원

- Firestore 오프라인 캐시 활성화
- 네트워크 없을 때도 Room 데이터로 작동
- 네트워크 복구 시 자동 동기화
