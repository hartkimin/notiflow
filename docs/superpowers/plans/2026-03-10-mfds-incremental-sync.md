# MFDS Incremental Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace full-resync-every-time with totalCount-based incremental sync so only new/missing pages are fetched.

**Architecture:** A new `mfds_sync_checkpoints` table tracks per-source_type sync state (db_count, api_total, last_page). A `calculateStartPage()` function compares DB count with API totalCount to determine the start page. The existing `runFullSync()` loop updates the checkpoint on every page. The UI shows sync progress percentage and a dropdown for full refresh.

**Tech Stack:** PostgreSQL (migration), TypeScript/Next.js (mfds-sync.ts, API route, server actions, React component)

**Spec:** `docs/superpowers/specs/2026-03-10-mfds-incremental-sync-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/supabase/supabase/migrations/00037_mfds_sync_checkpoints.sql` | Create | New table + RLS + seed from existing data |
| `apps/web/src/lib/mfds-sync.ts` | Modify | Add `calculateStartPage()`, update `runFullSync()` to write checkpoints |
| `apps/web/src/app/api/sync-mfds/route.ts` | Modify | Accept `mode` param, use `calculateStartPage()` |
| `apps/web/src/lib/actions.ts` | Modify | Add `getSyncCheckpoints()`, update `getMfdsSyncStatus()` |
| `apps/web/src/components/mfds-search-panel.tsx` | Modify | Banner with %, dropdown for full refresh, improved progress |
| `apps/web/src/app/api/cron/mfds-sync/route.ts` | Modify | Use auto mode via `calculateStartPage()` |

---

## Chunk 1: Database + Core Sync Logic

### Task 1: Create migration for mfds_sync_checkpoints

**Files:**
- Create: `packages/supabase/supabase/migrations/00037_mfds_sync_checkpoints.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 00037_mfds_sync_checkpoints.sql
-- Checkpoint table for incremental MFDS sync

CREATE TABLE IF NOT EXISTS mfds_sync_checkpoints (
  source_type    TEXT PRIMARY KEY,
  db_count       INT NOT NULL DEFAULT 0,
  api_total      INT NOT NULL DEFAULT 0,
  last_page      INT NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'idle',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE mfds_sync_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read checkpoints"
  ON mfds_sync_checkpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage checkpoints"
  ON mfds_sync_checkpoints FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed from existing data
INSERT INTO mfds_sync_checkpoints (source_type, db_count, last_page, status)
SELECT
  source_type,
  COUNT(*)::INT AS db_count,
  (COUNT(*) / 500)::INT AS last_page,
  'idle' AS status
FROM mfds_items
GROUP BY source_type
ON CONFLICT (source_type) DO NOTHING;
```

- [ ] **Step 2: Run migration against local DB**

```bash
docker exec supabase_db_supabase psql -U postgres -d postgres -f /dev/stdin < packages/supabase/supabase/migrations/00037_mfds_sync_checkpoints.sql
```

Expected: table created, 2 rows seeded (drug + device_std).

- [ ] **Step 3: Verify seed data**

```bash
docker exec supabase_db_supabase psql -U postgres -d postgres -c "SELECT * FROM mfds_sync_checkpoints;"
```

Expected: `drug | 44081 | 0 | 88 | idle` and `device_std | 460134 | 0 | 920 | idle`

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/supabase/migrations/00037_mfds_sync_checkpoints.sql
git commit -m "feat: add mfds_sync_checkpoints table for incremental sync"
```

---

### Task 2: Add calculateStartPage() to mfds-sync.ts

**Files:**
- Modify: `apps/web/src/lib/mfds-sync.ts`

- [ ] **Step 1: Add the OVERLAP_PAGES constant and fetchApiTotalCount helper**

After line 11 (`const PAGE_SIZE = 500;`), add:

```typescript
const OVERLAP_PAGES = 5;
```

After the `fetchPage()` function (after line 79), add:

```typescript
/** Lightweight call: fetch only totalCount without downloading items */
async function fetchApiTotalCount(
  config: ApiConfig,
  apiKey: string,
): Promise<number> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: "1",
    numOfRows: "1",
    type: "json",
  });
  const res = await fetch(`${config.url}?${params}`);
  if (!res.ok) throw new Error(`MFDS API ${res.status}`);
  const json = await res.json();
  return (json?.body?.totalCount as number) ?? 0;
}
```

- [ ] **Step 2: Add calculateStartPage() function**

After `fetchApiTotalCount`, add:

```typescript
export interface StartPageResult {
  startPage: number;
  apiTotal: number;
  dbCount: number;
  syncMode: "incremental" | "resume" | "full" | "skip";
}

export async function calculateStartPage(
  sourceType: string,
  apiKey: string,
  mode: "auto" | "full",
): Promise<StartPageResult> {
  const admin = createAdminSupabase();
  const config = MFDS_API_CONFIGS[sourceType];
  if (!config) throw new Error(`Unknown source type: ${sourceType}`);

  if (mode === "full") {
    // Reset checkpoint
    await admin
      .from("mfds_sync_checkpoints")
      .upsert({ source_type: sourceType, db_count: 0, api_total: 0, last_page: 0, status: "idle" });
    return { startPage: 1, apiTotal: 0, dbCount: 0, syncMode: "full" };
  }

  // Read checkpoint
  const { data: cp } = await admin
    .from("mfds_sync_checkpoints")
    .select("*")
    .eq("source_type", sourceType)
    .single();

  // If currently syncing (interrupted), resume from last_page + 1
  if (cp?.status === "syncing") {
    const apiTotal = await fetchApiTotalCount(config, apiKey);
    return {
      startPage: (cp.last_page ?? 0) + 1,
      apiTotal,
      dbCount: cp.db_count ?? 0,
      syncMode: "resume",
    };
  }

  // Fetch API totalCount (single lightweight call)
  const apiTotal = await fetchApiTotalCount(config, apiKey);
  const dbCount = cp?.db_count ?? 0;

  // Nothing new
  if (apiTotal === (cp?.api_total ?? 0) && apiTotal <= dbCount) {
    return { startPage: 0, apiTotal, dbCount, syncMode: "skip" };
  }

  // Incremental: start from where DB left off, minus overlap for safety
  const startPage = Math.max(1, Math.floor(dbCount / PAGE_SIZE) + 1 - OVERLAP_PAGES);
  return { startPage, apiTotal, dbCount, syncMode: "incremental" };
}
```

- [ ] **Step 3: Modify runFullSync() to update checkpoints on each page**

In `runFullSync()`, add `apiTotal` parameter after `onProgress`:

```typescript
export async function runFullSync(
  sourceType: string,
  apiKey: string,
  logId: number,
  startPage = 1,
  priorFetched = 0,
  priorUpserted = 0,
  onProgress?: (progress: SyncProgress) => void,
  apiTotal = 0,  // <-- NEW: pass through for checkpoint updates
): Promise<SyncResult> {
```

Inside the page loop, after the existing `mfds_sync_logs` update (line 207-214), add checkpoint update:

```typescript
      // Update checkpoint
      await admin
        .from("mfds_sync_checkpoints")
        .upsert({
          source_type: sourceType,
          last_page: currentPage,
          db_count: totalFetched,
          api_total: apiTotal || totalCount,
          status: "syncing",
          updated_at: new Date().toISOString(),
        });
```

In the "All pages completed" block (line 228-239), after the sync_logs update, add:

```typescript
    // Finalize checkpoint
    const { count: finalCount } = await admin
      .from("mfds_items")
      .select("id", { count: "exact", head: true })
      .eq("source_type", sourceType);

    await admin
      .from("mfds_sync_checkpoints")
      .upsert({
        source_type: sourceType,
        last_page: currentPage - 1,
        db_count: finalCount ?? totalFetched,
        api_total: apiTotal || totalCount,
        status: "completed",
        updated_at: new Date().toISOString(),
      });
```

In the time-budget partial block (line 142-167), add checkpoint update before return:

```typescript
        // Update checkpoint for resume
        await admin
          .from("mfds_sync_checkpoints")
          .upsert({
            source_type: sourceType,
            last_page: currentPage - 1,
            db_count: totalFetched,
            api_total: apiTotal || totalCount,
            status: "syncing",
            updated_at: new Date().toISOString(),
          });
```

- [ ] **Step 4: Export new types and PAGE_SIZE**

Add `export` to `PAGE_SIZE`:

```typescript
export const PAGE_SIZE = 500;
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/mfds-sync.ts
git commit -m "feat: add calculateStartPage() and checkpoint updates to mfds-sync"
```

---

### Task 3: Update API route to use calculateStartPage

**Files:**
- Modify: `apps/web/src/app/api/sync-mfds/route.ts`

- [ ] **Step 1: Update imports**

Add `calculateStartPage` to imports:

```typescript
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
  createAdminSupabase,
  calculateStartPage,
} from "@/lib/mfds-sync";
```

- [ ] **Step 2: Add mode param and auto-calculate startPage**

Replace the body parsing block (lines 13-18) with:

```typescript
  const body = await req.json();
  const sourceType: string = body.sourceType;
  const mode: "auto" | "full" = body.mode ?? "auto";
  const continueLogId: number | undefined = body.logId;
  // Legacy continuation params (used by NDJSON auto-continue)
  const explicitStartPage: number | undefined = body.startPage;
  const priorFetched: number = body.priorFetched ?? 0;
  const priorUpserted: number = body.priorUpserted ?? 0;
```

After the API key check (after line 43), add auto-calculation logic:

```typescript
  // Determine start page — legacy continuation takes priority, then auto-calculate
  let startPage = explicitStartPage ?? 1;
  let apiTotal = 0;
  let syncMode: string = mode;

  if (!continueLogId && !explicitStartPage) {
    // Fresh sync — use calculateStartPage
    const calc = await calculateStartPage(sourceType, setting.value, mode);
    if (calc.syncMode === "skip") {
      return new Response(
        JSON.stringify({ type: "done", outcome: "skip", totalFetched: 0, totalUpserted: 0, syncMode: "skip" }) + "\n",
        { headers: { "Content-Type": "application/x-ndjson" } },
      );
    }
    startPage = calc.startPage;
    apiTotal = calc.apiTotal;
    syncMode = calc.syncMode;
  }
```

Update the `runFullSync` call inside the stream (line 67-75) to pass `apiTotal`:

```typescript
        const result = await runFullSync(
          sourceType,
          setting.value,
          logId,
          startPage,
          priorFetched,
          priorUpserted,
          (progress) => send({ type: "progress", ...progress, apiTotal, syncMode }),
          apiTotal,
        );
        send({ type: "done", ...result, apiTotal, syncMode });
```

Also update the `send({ type: "start" })` line to include metadata:

```typescript
      send({ type: "start", logId, startPage, apiTotal, syncMode });
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/sync-mfds/route.ts
git commit -m "feat: sync-mfds route uses calculateStartPage for auto/full modes"
```

---

### Task 4: Update cron route to use auto mode

**Files:**
- Modify: `apps/web/src/app/api/cron/mfds-sync/route.ts`

- [ ] **Step 1: Add calculateStartPage import and replace fresh sync logic**

Update imports:

```typescript
import {
  MFDS_API_CONFIGS,
  runFullSync,
  createSyncLog,
  createAdminSupabase,
  getMfdsApiKeyFromDb,
  calculateStartPage,
} from "@/lib/mfds-sync";
```

Replace the "No partial syncs" block (lines 76-90) with:

```typescript
  // No partial syncs — incremental sync for each source type
  const sourceTypes = Object.keys(MFDS_API_CONFIGS);

  for (const sourceType of sourceTypes) {
    const calc = await calculateStartPage(sourceType, apiKey, "auto");
    if (calc.syncMode === "skip") {
      console.log(`Cron: ${sourceType} is up to date, skipping`);
      continue;
    }

    const logId = await createSyncLog("cron", sourceType);
    try {
      const result = await runFullSync(
        sourceType, apiKey, logId, calc.startPage, 0, 0, undefined, calc.apiTotal,
      );
      if (result.outcome === "partial") {
        break; // next cron invocation will continue
      }
    } catch (err) {
      console.error(`Cron sync failed for ${sourceType}:`, (err as Error).message);
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/cron/mfds-sync/route.ts
git commit -m "feat: cron mfds-sync uses incremental mode via calculateStartPage"
```

---

## Chunk 2: Server Actions + UI

### Task 5: Update server actions (getMfdsSyncStatus with checkpoint data)

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

- [ ] **Step 1: Add getSyncCheckpoints() and update getMfdsSyncStatus()**

Add new function after the existing `getResumableSyncLog`:

```typescript
export async function getSyncCheckpoints(): Promise<
  Record<string, { dbCount: number; apiTotal: number; lastPage: number; status: string }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mfds_sync_checkpoints")
    .select("source_type, db_count, api_total, last_page, status");

  const result: Record<string, { dbCount: number; apiTotal: number; lastPage: number; status: string }> = {};
  for (const row of data ?? []) {
    result[row.source_type] = {
      dbCount: row.db_count,
      apiTotal: row.api_total,
      lastPage: row.last_page,
      status: row.status,
    };
  }
  return result;
}
```

Update `getMfdsSyncStatus()` return type — add `drugApiTotal`, `deviceApiTotal`:

In the return type, add:

```typescript
  drugApiTotal: number;
  deviceApiTotal: number;
```

Add a checkpoint query to the `Promise.all` inside `getMfdsSyncStatus`:

```typescript
      // Add this to the Promise.all array:
      supabase
        .from("mfds_sync_checkpoints")
        .select("source_type, api_total")
        .in("source_type", ["drug", "device_std"]),
```

And extract the data in the return:

```typescript
  // After the Promise.all destructure, add checkpoint data:
  const checkpointMap: Record<string, number> = {};
  for (const row of checkpointResult.data ?? []) {
    checkpointMap[row.source_type] = row.api_total;
  }

  return {
    // ... existing fields ...
    drugApiTotal: checkpointMap["drug"] ?? 0,
    deviceApiTotal: checkpointMap["device_std"] ?? 0,
  };
```

- [ ] **Step 2: Remove getResumableSyncLog (superseded by checkpoint logic)**

The `getResumableSyncLog` function added earlier is no longer needed — checkpoint status handles resume. However, keep it for now as the UI still references it for the page-load resume effect. We'll clean it up when updating the component.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat: add getSyncCheckpoints and apiTotal to getMfdsSyncStatus"
```

---

### Task 6: Update MfdsSearchPanel — banner, dropdown, progress

**Files:**
- Modify: `apps/web/src/components/mfds-search-panel.tsx`

- [ ] **Step 1: Update syncStatus type in props to include apiTotal**

In `MfdsSearchPanelProps`, update the `syncStatus` type:

```typescript
  syncStatus?: {
    lastSync?: string | null;
    drugCount: number;
    deviceCount: number;
    lastDrugSync?: string | null;
    lastDeviceSync?: string | null;
    favDrugCount?: number;
    favDeviceCount?: number;
    drugApiTotal?: number;    // NEW
    deviceApiTotal?: number;  // NEW
  };
```

- [ ] **Step 2: Update browse banner to show API total and percentage**

Replace the browse mode banner (the `{mode === "browse" && syncStatus && (` block) with:

```tsx
      {mode === "browse" && syncStatus && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
            <span>
              의약품 <strong className="text-foreground">{syncStatus.drugCount.toLocaleString()}</strong>
              {syncStatus.drugApiTotal ? (
                <> / {syncStatus.drugApiTotal.toLocaleString()}건
                  <span className="ml-1 text-xs">
                    ({Math.round((syncStatus.drugCount / syncStatus.drugApiTotal) * 100)}%)
                  </span>
                </>
              ) : <>건</>}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {syncStatus.lastDrugSync
                ? formatRelativeTime(syncStatus.lastDrugSync)
                : <span className="text-amber-600">미동기화</span>}
            </span>
            <span className="text-border">|</span>
            <span>
              의료기기 <strong className="text-foreground">{syncStatus.deviceCount.toLocaleString()}</strong>
              {syncStatus.deviceApiTotal ? (
                <> / {syncStatus.deviceApiTotal.toLocaleString()}건
                  <span className="ml-1 text-xs">
                    ({Math.round((syncStatus.deviceCount / syncStatus.deviceApiTotal) * 100)}%)
                  </span>
                </>
              ) : <>건</>}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {syncStatus.lastDeviceSync
                ? formatRelativeTime(syncStatus.lastDeviceSync)
                : <span className="text-amber-600">미동기화</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {syncProgress && (
              <span className="text-xs text-muted-foreground">{syncProgress}</span>
            )}
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-r-none"
                disabled={isSyncing}
                onClick={handleMfdsSync}
              >
                {isSyncing ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                동기화
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-l-none border-l-0 px-1.5"
                disabled={isSyncing}
                onClick={handleFullSync}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Add handleFullSync function**

After `handleMfdsSync`, add:

```typescript
  async function handleFullSync() {
    if (!confirm("전체 새로고침은 1페이지부터 모든 데이터를 다시 동기화합니다. 계속하시겠습니까?")) return;
    setIsSyncing(true);
    setSyncProgress("전체 새로고침 시작...");

    try {
      const res = await fetch("/api/sync-mfds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: tab, mode: "full" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "동기화 시작 실패");
      }

      await readStream(res);
    } catch (err) {
      toast.error(
        `동기화 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
      );
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }
```

- [ ] **Step 4: Update handleMfdsSync to use auto mode (remove getResumableSyncLog)**

Replace `handleMfdsSync` with a simplified version that just passes `mode: "auto"`:

```typescript
  async function handleMfdsSync() {
    setIsSyncing(true);
    setSyncProgress("동기화 확인 중...");

    try {
      const res = await fetch("/api/sync-mfds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: tab, mode: "auto" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "동기화 시작 실패");
      }

      // Check for "skip" response (no new data)
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("ndjson")) {
        await readStream(res);
      }
    } catch (err) {
      toast.error(
        `동기화 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
      );
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }
```

- [ ] **Step 5: Update readStream to show enriched progress**

In the `readStream` callback, update the "progress" event handler to show page info and percentage:

```typescript
          } else if (event.type === "progress") {
            const pct = event.apiTotal
              ? ` (${Math.round((event.totalFetched / event.apiTotal) * 100)}%)`
              : "";
            const modeLabel = event.syncMode === "incremental" ? "증분 " : "";
            setSyncProgress(
              `${modeLabel}동기화 중... ${event.totalFetched.toLocaleString()}건 처리됨${pct}`,
            );
```

Also update the "start" event to show sync mode:

```typescript
          if (event.type === "start") {
            lastLogId = event.logId;
            if (event.syncMode === "incremental") {
              setSyncProgress(
                `증분 동기화 시작 (${event.startPage}페이지부터)...`,
              );
            } else if (event.syncMode === "resume") {
              setSyncProgress(
                `이전 동기화 이어서 진행 (${event.startPage}페이지부터)...`,
              );
            }
```

And update the "done" handler for "skip":

```typescript
          } else if (event.type === "done") {
            if (event.outcome === "skip" || event.syncMode === "skip") {
              toast.success("최신 상태입니다. 새로운 데이터가 없습니다.");
              doSearch(1);
            } else if (event.outcome === "partial" && event.nextPage && lastLogId) {
```

- [ ] **Step 6: Simplify page-load resume useEffect**

Replace the page-load resume `useEffect` to use checkpoint-based logic. The API route now handles resume automatically via `calculateStartPage`, so the client just needs to trigger `mode: "auto"`:

In the existing `useEffect` for resume, simplify the stale-running detection: instead of polling and manually calling `getResumableSyncLog`, just let the user click the sync button (which now auto-detects resume via checkpoints). Remove the complex polling logic for stale detection.

Keep the `useEffect` for detecting actively running syncs (to show progress), but remove the stale-resume auto-trigger.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/mfds-search-panel.tsx
git commit -m "feat: sync banner shows API total percentage, dropdown for full refresh"
```

---

### Task 7: Update products pages to pass new syncStatus fields

**Files:**
- Modify: `apps/web/src/app/(dashboard)/products/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/products/my/page.tsx`

- [ ] **Step 1: No code changes needed**

Both pages already call `getMfdsSyncStatus()` and pass the full result to `MfdsSearchPanel`. Since we're adding new fields to the return type, they flow through automatically.

Verify by checking that the `syncStatus` prop is spread or passed as-is (it is).

- [ ] **Step 2: Build and verify**

```bash
docker compose up -d --build --no-deps web
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 3: Manual verification**

1. Open `/products` — browse banner should show "의약품 44,081 / 44,081건 (100%)"
2. Click 동기화 — should show "최신 상태입니다" toast for drug (100% synced)
3. Switch to 의료기기 tab — should show "460,134 / 2,577,150건 (18%)"
4. Click 동기화 — should start from page ~916 instead of page 1
5. Click dropdown ▼ → "전체 새로고침" should confirm and start from page 1

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: MFDS incremental sync — totalCount comparison, checkpoint resume, full refresh option"
```
