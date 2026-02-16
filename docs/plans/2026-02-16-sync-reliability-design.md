# Sync Reliability Design — WorkManager + Realtime Trigger

## Problem

모바일 앱에서 메시지 캡쳐 시 Supabase 동기화가 불안정합니다:
- `syncMessage()` 실패 시 `needsSync=1`로만 마킹하고 자동 재시도 없음
- 수동 동기화 버튼을 눌러야만 보류 메시지가 동기화됨
- 웹 대시보드에서 기기에 동기화를 트리거할 수단 없음

## Solution: 접근법 A — WorkManager + Realtime 트리거

### 1. 모바일 — SyncRetryWorker (자동 재시도)

`syncMessage()` 실패 시 Android WorkManager로 재시도 예약:
- **Constraint:** `NetworkType.CONNECTED` (네트워크 연결 시에만 실행)
- **BackoffPolicy:** `EXPONENTIAL` (30초 → 1분 → 2분 → 4분 → 8분)
- **maxRetries:** 5회
- **Worker 내용:** `getPendingSync()` → 각각 upsert 시도 → 전부 성공 시 `Result.success()`, 일부 실패 시 `Result.retry()`

### 2. 웹 — 강제 동기화 버튼 + Realtime 트리거

1. `mobile_devices` 테이블에 `sync_requested_at TIMESTAMPTZ` 컬럼 추가
2. 웹 기기 목록 각 행에 "동기화" 버튼 → `UPDATE sync_requested_at = now()`
3. 모바일 앱이 `mobile_devices` Realtime 구독으로 변경 감지
4. `sync_requested_at` 변경 시 `syncPendingMessages()` 실행
5. 완료 후 `last_sync_at` 갱신 → 웹 heartbeat 자동 갱신

### 3. Heartbeat 쓰로틀

- `registerDevice()` (last_sync_at 갱신)를 `syncMessage()` 성공 시에도 호출
- 과다 호출 방지: 마지막 갱신 후 1분 이상 경과 시에만 실행

## 변경 파일

### 모바일 (신규)
| 파일 | 설명 |
|---|---|
| `data/sync/SyncRetryWorker.kt` | HiltWorker — 보류 메시지 재시도 |
| `di/WorkerModule.kt` | Hilt WorkerFactory 설정 |

### 모바일 (수정)
| 파일 | 변경 내용 |
|---|---|
| `data/sync/SyncManager.kt` | Worker 예약 + mobile_devices Realtime 구독 + heartbeat 쓰로틀 |
| `data/supabase/SupabaseDataSource.kt` | `MobileDeviceDto`에 `sync_requested_at` 필드 |
| `NotiFlowApp.kt` | WorkManager + HiltWorkerFactory 초기화 |
| `build.gradle.kts` | WorkManager + Hilt Worker 의존성 추가 |

### 웹 (수정)
| 파일 | 변경 내용 |
|---|---|
| `lib/actions.ts` | `requestDeviceSync(id)` 서버 액션 |
| `lib/types.ts` | `MobileDevice`에 `sync_requested_at` 추가 |
| `components/device-list.tsx` | 각 행 동기화 버튼 + 전체 동기화 버튼 |

### Supabase (신규)
| 파일 | 설명 |
|---|---|
| `migrations/00013_device_sync_request.sql` | `sync_requested_at` 컬럼 추가 |

## 데이터 흐름

```
메시지 캡쳐 → insert() → syncMessage()
   ├─ 성공 → needsSync=0, heartbeat 갱신 (쓰로틀)
   └─ 실패 → needsSync=1 + SyncRetryWorker 예약
                              ↓
                     네트워크 복구 시 자동 실행
                              ↓
                     syncPendingMessages() → 성공 → needsSync=0

웹 "동기화" 버튼 클릭
   → UPDATE sync_requested_at = now()
   → Supabase Realtime
   → 모바일 handleMobileDeviceChange()
   → syncPendingMessages()
   → UPDATE last_sync_at = now()
   → 웹 heartbeat 자동 갱신
```
