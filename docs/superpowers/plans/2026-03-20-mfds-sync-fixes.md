# MFDS Sync System Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix code review issues in the MFDS sync system — race conditions, resume bugs, cancellation, and dead code — for Docker deployment.

**Architecture:** All fixes are in the existing sync engine (`mfds-sync.ts`), API routes (`sync-mfds/`, `cron/`), and one new migration. Legacy Edge Function removed. Behavioral change: concurrent syncs for different source types (drug + device_std) are now allowed (previously blocked globally).

**Tech Stack:** TypeScript, Next.js API Routes, Supabase PostgreSQL, Docker

---

### Task 1: Add unique partial index and fix race conditions in all routes

**Files:**
- Create: `packages/supabase/migrations/00045_mfds_sync_race_guard.sql`
- Modify: `apps/web/src/app/api/sync-mfds/route.ts`
- Modify: `apps/web/src/app/api/cron/mfds-sync/route.ts`
- Modify: `apps/web/src/app/api/cron/mfds-sync-continue/route.ts`

Currently, `route.ts:41-49` checks for running syncs then creates a new log — a classic TOCTOU race. The cron routes have the same issue. The fix uses a DB-level unique partial index so only one running sync per source_type can exist.

**Note:** This changes behavior — concurrent syncs for *different* source types (e.g., drug and device_std simultaneously) are now allowed. Previously, the global check blocked all concurrent syncs regardless of source type.

- [ ] **Step 1: Create migration with unique partial index**

```sql
-- 00045_mfds_sync_race_guard.sql
-- Prevent concurrent syncs for the same source_type at DB level.
-- Only one row with status='running' per source_type is allowed.

CREATE UNIQUE INDEX IF NOT EXISTS idx_mfds_sync_one_running
  ON mfds_sync_logs (source_type)
  WHERE status = 'running';
```

- [ ] **Step 2: Update sync-mfds/route.ts — fix race condition + start page**

In `apps/web/src/app/api/sync-mfds/route.ts`, replace lines 41-90 (the check-running + partial + new sync logic):

```typescript
let logId: number;
let syncMode: SyncMode;
let startPage: number;
let priorFetched: number;
let priorUpserted: number;

// Check for resumable partial sync
const { data: partial } = await admin
  .from("mfds_sync_logs")
  .select("id, sync_mode, next_page, total_fetched, total_upserted")
  .eq("source_type", sourceType)
  .eq("status", "partial")
  .order("started_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (partial) {
  // Resume partial — atomically update only if still partial
  const { data: resumeData, error: resumeErr } = await admin
    .from("mfds_sync_logs")
    .update({ status: "running" })
    .eq("id", partial.id)
    .eq("status", "partial")
    .select("id")
    .maybeSingle();
  if (resumeErr || !resumeData) {
    return NextResponse.json({ error: "이미 동기화가 진행 중입니다." }, { status: 409 });
  }
  logId = partial.id;
  syncMode = (partial.sync_mode as SyncMode) ?? requestedMode;
  startPage = partial.next_page ?? 1;
  priorFetched = partial.total_fetched ?? 0;
  priorUpserted = partial.total_upserted ?? 0;
  console.log(`[Sync API] Resuming logId=${logId} from page ${startPage}`);
} else {
  // New sync — always start at page 1 (UPSERT handles duplicates safely)
  try {
    logId = await createSyncLog("manual", sourceType, requestedMode);
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "이미 동기화가 진행 중입니다." }, { status: 409 });
    }
    throw err;
  }
  syncMode = requestedMode;
  startPage = 1;
  priorFetched = 0;
  priorUpserted = 0;
  console.log(`[Sync API] New ${syncMode} sync logId=${logId}, starting page 1`);
}
```

Key changes:
- Removed the global "check if running" query (old lines 41-49)
- Resume path: added `.eq("status", "partial")` guard + checks `resumeData` to confirm update happened
- New sync path: catches `23505` unique violation from the partial index
- Removed `Math.floor(existingCount / 500) + 1` heuristic — always page 1

- [ ] **Step 3: Update cron/mfds-sync/route.ts — wrap createSyncLog in try/catch**

In `apps/web/src/app/api/cron/mfds-sync/route.ts`, wrap the `createSyncLog` call (line 34) in try/catch:

```typescript
for (const sourceType of Object.keys(MFDS_API_CONFIGS)) {
  try {
    const { mode, reason } = await detectSyncMode(sourceType, apiKey);
    let logId: number;
    try {
      logId = await createSyncLog("cron", sourceType, mode);
    } catch (err: any) {
      if (err?.code === "23505") {
        results[sourceType] = { outcome: "skipped", reason: "이미 동기화 진행 중" };
        continue;
      }
      throw err;
    }
    const result = await runSync(sourceType, apiKey, logId, mode);
    results[sourceType] = { mode, reason, outcome: result.outcome };
  } catch (err) {
    results[sourceType] = { outcome: "error", message: (err as Error).message };
  }
}
```

- [ ] **Step 4: Update cron/mfds-sync-continue/route.ts — add status guard on resume**

In `apps/web/src/app/api/cron/mfds-sync-continue/route.ts`, replace lines 31-33:

```typescript
// Atomically update only if still partial
const { data: resumed, error: resumeErr } = await admin
  .from("mfds_sync_logs")
  .update({ status: "running" })
  .eq("id", partial.id)
  .eq("status", "partial")
  .select("id")
  .maybeSingle();
if (resumeErr || !resumed) {
  return NextResponse.json({ ok: true, message: "Sync already running or no longer partial" });
}
```

- [ ] **Step 5: Apply migration locally**

Run: `npm run supabase:reset`

- [ ] **Step 6: Commit**

```bash
git add packages/supabase/migrations/00045_mfds_sync_race_guard.sql \
  apps/web/src/app/api/sync-mfds/route.ts \
  apps/web/src/app/api/cron/mfds-sync/route.ts \
  apps/web/src/app/api/cron/mfds-sync-continue/route.ts
git commit -m "fix: add unique index and fix race conditions in all MFDS sync routes"
```

---

### Task 2: Fix incremental sync date parameters lost on resume

**Files:**
- Modify: `apps/web/src/lib/mfds-sync.ts:160-212`

When resuming an incremental sync (`startPage > 1`), the condition on line 179 (`syncMode === "incremental" && startPage <= 1`) is false, so `startDate`/`endDate` stay `undefined`. The resumed sync silently becomes a full sync.

- [ ] **Step 1: Add date parameter restoration for resumed incremental syncs**

In `apps/web/src/lib/mfds-sync.ts`, after the existing incremental date computation block (line 210), add:

```typescript
// If resuming an incremental sync, restore saved date params from sync log
if (syncMode === "incremental" && startPage > 1 && !startDate) {
  const { data: logData } = await admin
    .from("mfds_sync_logs")
    .select("sync_start_date, sync_end_date")
    .eq("id", logId)
    .single();
  if (logData?.sync_start_date && logData?.sync_end_date) {
    startDate = logData.sync_start_date;
    endDate = logData.sync_end_date;
    console.log(`[Sync] Restored date range from log: ${startDate} ~ ${endDate}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/mfds-sync.ts
git commit -m "fix: restore date parameters when resuming incremental MFDS sync"
```

---

### Task 3: Improve cancellation — check every page + prevent status overwrite

**Files:**
- Modify: `apps/web/src/lib/mfds-sync.ts:222-299`

Two issues: (1) cancellation only checked every 5 pages — up to 30+ seconds delay. (2) Progress update on line 293 can overwrite a `cancelled` status.

- [ ] **Step 1: Change cancellation check to every page**

In `apps/web/src/lib/mfds-sync.ts`, replace the cancellation block (lines 224-235):

```typescript
// Check cancellation every page
const { data: logStatus } = await admin
  .from("mfds_sync_logs")
  .select("status")
  .eq("id", logId)
  .single();
if (logStatus?.status === "cancelled") {
  console.log("[Sync] Cancelled.");
  return { totalFetched, totalUpserted, outcome: "cancelled", nextPage: page, apiTotalCount };
}
```

- [ ] **Step 2: Add status guard to progress update**

In `apps/web/src/lib/mfds-sync.ts`, modify the progress update (around line 293) — add `.eq("status", "running")`:

```typescript
// Save progress — only if still running (prevents overwriting cancelled status)
await admin.from("mfds_sync_logs").update({
  total_fetched: totalFetched,
  total_upserted: totalUpserted,
  next_page: page + 1,
  api_total_count: apiTotalCount,
  duration_ms: Date.now() - t0,
}).eq("id", logId).eq("status", "running");
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/mfds-sync.ts
git commit -m "fix: check cancellation every page and prevent status overwrite"
```

---

### Task 4: Clean up dead code

**Files:**
- Modify: `apps/web/src/lib/mfds-sync.ts` (remove `pageSkipped`, `totalSkipped`, aliases)
- Delete: `packages/supabase/functions/sync-mfds/index.ts` (legacy Edge Function)

- [ ] **Step 1: Remove `pageSkipped` and `totalSkipped` from mfds-sync.ts**

In `apps/web/src/lib/mfds-sync.ts`:

1. Remove `totalSkipped` from `SyncProgress` interface (line 38)
2. Remove `totalSkipped` from `SyncResult` interface (line 48)
3. Remove `let totalSkipped = 0;` (line 217)
4. Remove `let pageSkipped = 0;` (line 262)
5. Remove `totalSkipped += pageSkipped;` (line 278)
6. Remove `totalSkipped` from all return statements (lines 233, 348, 364) — already removed by Task 3's cancellation return
7. Remove `totalSkipped` from `onProgress` call (line 304)
8. Simplify log line (line 312-313): remove `skipInfo`
9. Simplify final log (line 347): remove skip count

- [ ] **Step 2: Remove backward-compatible aliases**

In `apps/web/src/lib/mfds-sync.ts`, delete:

```typescript
// Delete these lines (verified unused by grep):
export const runAdvancedSync = runSync;
export const runFullSync = runSync;
```

- [ ] **Step 3: Delete legacy Edge Function**

Delete: `packages/supabase/functions/sync-mfds/index.ts`

This Edge Function has smaller page sizes (100 vs 500), no retry logic, no resumability, and no cancellation. Fully superseded by `mfds-sync.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/mfds-sync.ts
git rm packages/supabase/functions/sync-mfds/index.ts
git commit -m "refactor: remove dead code — pageSkipped, aliases, legacy Edge Function"
```

---

### Task 5: Replace `triggerMfdsSync` stub with real implementation

**Files:**
- Modify: `apps/web/src/lib/actions.ts:869-871`
- Modify: `apps/web/src/components/mfds-sync-panel.tsx`

The `MfdsSyncPanel` calls `triggerMfdsSync("all")` which returns hardcoded zeros. Replace the stub with a real implementation and update the panel to show background sync status.

- [ ] **Step 1: Replace stub in actions.ts with real API call**

In `apps/web/src/lib/actions.ts`, replace the stub (lines 869-871):

```typescript
export async function triggerMfdsSync(sourceFilter: string) {
  const sources = sourceFilter === "all" ? ["drug", "device_std"] : [sourceFilter];
  const results: Record<string, any> = {};
  const errors: string[] = [];

  for (const sourceType of sources) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : ""}${typeof window === "undefined" ? `http://localhost:${process.env.PORT || 3000}` : ""}/api/sync-mfds`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, syncMode: "full" }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      errors.push(`${sourceType}: ${data.error}`);
    } else {
      results[sourceType] = data;
    }
  }

  if (errors.length > 0) {
    return { success: false, stats: { drug_added: 0, device_added: 0, device_std_added: 0 }, errors };
  }
  return { success: true, stats: results, errors: null };
}
```

Note: Since `triggerMfdsSync` is a server action (called from `mfds-sync-panel.tsx` via `startTransition`), and the sync API runs fire-and-forget, the response is immediate. The sync runs in the background.

- [ ] **Step 2: Update panel toast message**

In `apps/web/src/components/mfds-sync-panel.tsx`, update the success handler in `handleSync` (around line 103-106):

```typescript
if (result.success) {
  toast.success("동기화가 시작되었습니다. 진행 상황은 자동으로 업데이트됩니다.");
} else {
  const errors = result.errors as string[] | null;
  const errMsg = errors?.join("; ") ?? "알 수 없는 오류";
  toast.error(`동기화 시작 실패: ${errMsg}`);
}
```

- [ ] **Step 3: Build check**

Run: `npm run build:web`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/actions.ts apps/web/src/components/mfds-sync-panel.tsx
git commit -m "fix: replace triggerMfdsSync stub with real sync API call"
```

---

## Task Dependency Order

```
Task 1 (race condition guard) — independent
Task 2 (date params resume) — independent
Task 3 (cancellation fix) — independent
Task 4 (dead code cleanup) — depends on Task 3 (both modify mfds-sync.ts)
Task 5 (triggerMfdsSync) — independent
```

Tasks 1, 2, 3, 5 can be done in parallel. Task 4 should follow Task 3.
