# MFDS Incremental Sync Design

**Date**: 2026-03-10
**Status**: Approved
**Approach**: totalCount 비교 + 차이분 페이지 동기화

## Problem

현재 MFDS 동기화는 매번 1페이지부터 전체를 재처리한다.
의료기기 API는 257만건(5,155페이지)으로, 전체 동기화에 수십 분이 소요되고 중단 시 처음부터 다시 시작해야 한다.

| 소스 | DB 건수 | API 전체 | 동기화율 |
|------|---------|----------|---------|
| 의약품 (drug) | 44,081 | 44,081 | 100% |
| 의료기기 (device_std) | 460,134 | 2,577,150 | 18% |

## API Characteristics

- **의약품**: ITEM_SEQ 오름차순 정렬, 신규 품목이 마지막 페이지에 추가됨 (안정적)
- **의료기기**: UDIDI_CD 오름차순 정렬, 순서와 날짜 불일치 (신규가 끝에 오지 않음)
- **날짜 필터**: 의약품 `item_permit_date`는 연도 단위만 지원, 의료기기 미지원
- **페이지 접근**: 아무 페이지나 직접 접근 가능, `totalCount` 일관성 확인됨

## Design

### 1. New Table: `mfds_sync_checkpoints`

source_type별 동기화 상태를 추적하는 단일 row 테이블.

```sql
CREATE TABLE mfds_sync_checkpoints (
  source_type    TEXT PRIMARY KEY,
  db_count       INT NOT NULL DEFAULT 0,
  api_total      INT NOT NULL DEFAULT 0,
  last_page      INT NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'idle',  -- idle | syncing | completed
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mfds_sync_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON mfds_sync_checkpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage" ON mfds_sync_checkpoints FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 2. Three Sync Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **incremental** | 동기화 버튼 (기본) / 일일 cron | totalCount 비교 → 차이분 페이지만 |
| **resume** | 중단 후 재시작 시 자동 | checkpoint.last_page + 1부터 |
| **full** | 수동 "전체 새로고침" | 1페이지부터 전체 |

### 3. Sync Mode Decision Logic

```
1. Read checkpoint for source_type
2. IF checkpoint.status === 'syncing'
     → RESUME mode: startPage = last_page + 1
3. ELSE
     → Fetch API totalCount (pageNo=1, numOfRows=1)
     → IF apiTotal === checkpoint.api_total AND apiTotal === checkpoint.db_count
         → No changes, skip
     → ELSE
         → INCREMENTAL mode:
           startPage = max(1, floor(db_count / PAGE_SIZE) + 1 - OVERLAP_PAGES)
           where OVERLAP_PAGES = 5 (safety margin, UPSERT is idempotent)
4. FULL mode: explicit trigger only, startPage = 1
```

### 4. Changes to `mfds-sync.ts`

Add `calculateStartPage()` function:

```typescript
const OVERLAP_PAGES = 5;

async function calculateStartPage(
  sourceType: string,
  apiKey: string,
  mode: 'auto' | 'full',
): Promise<{
  startPage: number;
  apiTotal: number;
  dbCount: number;
  syncMode: 'incremental' | 'resume' | 'full' | 'skip';
}>
```

Modify `runFullSync()`:
- Accept `syncMode` parameter
- On each page completion: `UPDATE mfds_sync_checkpoints SET last_page = $page, status = 'syncing'`
- On completion: `UPDATE ... SET status = 'completed', db_count = $total, api_total = $apiTotal`
- On error/interruption: status stays 'syncing' → next run auto-resumes

### 5. Changes to API Route (`/api/sync-mfds`)

New request body parameter:
```typescript
{
  sourceType: string;
  mode?: 'auto' | 'full';  // default 'auto'
  // existing continuation params still supported
}
```

When `mode === 'auto'`:
1. Call `calculateStartPage()` to determine sync mode and startPage
2. If `syncMode === 'skip'` → return immediately with `{ type: "done", outcome: "skip" }`
3. Otherwise proceed with calculated startPage

When `mode === 'full'`:
1. Reset checkpoint: `last_page = 0, db_count = 0`
2. Start from page 1

### 6. UI Changes

**Sync banner (both browse and manage mode):**

Current:
```
의약품 44,081건  🕐 2시간 전  |  의료기기 460,134건  🕐 5시간 전
```

New:
```
의약품 44,081 / 44,081건 (100%) ✓  🕐 2시간 전  |  의료기기 460,134 / 2,577,150건 (18%)  🕐 5시간 전
```

**Sync button dropdown:**
- Default click → incremental/resume (auto mode)
- Dropdown option → "전체 새로고침" (full mode)

**Progress display during sync:**

Current: `동기화 중... 305,000건 처리됨`
New: `증분 동기화 중... 462,500 / 2,577,150 (18%) — 925 / 5,155 페이지`

### 7. Checkpoint Initialization

For existing deployments with data but no checkpoints:
- Migration inserts checkpoint rows based on current `COUNT(*)` from `mfds_items`
- `last_page = floor(count / PAGE_SIZE)`
- `api_total = 0` (unknown until first sync)
- `status = 'idle'`

### 8. Daily Cron Changes

`/api/cron/mfds-sync` uses `mode: 'auto'`:
- If no new items → skip (fast, single API call)
- If new items → incremental sync from checkpoint
- Full refresh: not triggered by cron (manual only)

## Risk Mitigation

- **API ordering changes**: OVERLAP_PAGES=5 ensures boundary items are re-processed. UPSERT is idempotent.
- **Missing updates to existing items**: Full refresh mode available for manual trigger. Consider monthly scheduled full refresh.
- **Stale checkpoint**: If checkpoint.status stays 'syncing' for >10 min, auto-resume kicks in (existing `getResumableSyncLog` logic).

## Files to Modify

1. `packages/supabase/supabase/migrations/00037_mfds_sync_checkpoints.sql` — new table + init
2. `apps/web/src/lib/mfds-sync.ts` — `calculateStartPage()`, modify `runFullSync()`
3. `apps/web/src/app/api/sync-mfds/route.ts` — accept `mode` param
4. `apps/web/src/lib/actions.ts` — `getSyncCheckpoints()`, update `getMfdsSyncStatus()`
5. `apps/web/src/components/mfds-search-panel.tsx` — banner UI, dropdown, progress display
6. `apps/web/src/app/api/cron/mfds-sync/route.ts` — use auto mode
