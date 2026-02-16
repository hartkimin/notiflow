# Sync Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make mobile-to-Supabase sync reliable with automatic retry on failure, web-triggered forced sync, and accurate heartbeat tracking.

**Architecture:** When `syncMessage()` fails, a WorkManager `OneTimeWorkRequest` with network constraint auto-retries pending messages. The web dashboard gets a "sync" button per device that writes `sync_requested_at` to Supabase, which the mobile Realtime subscription detects and triggers `syncPendingMessages()`. Heartbeat (`last_sync_at`) updates on every successful sync, throttled to 1-minute intervals.

**Tech Stack:** Android WorkManager 2.10, Hilt Worker (`@HiltWorker` + `@AssistedInject`), Supabase Realtime (Kotlin SDK), Next.js Server Actions, shadcn/ui

---

### Task 1: Supabase Migration — `sync_requested_at` Column

**Files:**
- Create: `packages/supabase/migrations/00015_device_sync_requested.sql`

**Step 1: Write the migration SQL**

```sql
-- 00015_device_sync_requested.sql
-- Adds sync_requested_at column to mobile_devices for web-triggered sync

ALTER TABLE public.mobile_devices
  ADD COLUMN IF NOT EXISTS sync_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.mobile_devices.sync_requested_at
  IS 'Set by web dashboard to trigger remote sync on the device via Realtime';
```

**Step 2: Apply migration to remote Supabase**

Run from project root:
```bash
cd packages/supabase && npx supabase db push --linked
```
Expected: Migration applied successfully.

**Step 3: Verify column exists**

Run:
```bash
cd packages/supabase && npx supabase db dump --linked --schema public | grep sync_requested_at
```
Expected: Column visible in `mobile_devices` table definition.

**Step 4: Commit**

```bash
git add packages/supabase/migrations/00015_device_sync_requested.sql
git commit -m "feat(supabase): add sync_requested_at column to mobile_devices"
```

---

### Task 2: Android — Add Hilt Worker Dependencies

**Files:**
- Modify: `apps/mobile/gradle/libs.versions.toml`
- Modify: `apps/mobile/app/build.gradle.kts:84-86`

**Step 1: Add `hilt-work` to version catalog**

In `apps/mobile/gradle/libs.versions.toml`, add to `[libraries]` section:

```toml
androidx-hilt-work = { group = "androidx.hilt", name = "hilt-work", version = "1.2.0" }
```

**Step 2: Add dependency to build.gradle.kts**

In `apps/mobile/app/build.gradle.kts`, add after the existing Hilt dependencies (after line 86 `implementation(libs.androidx.hilt.navigation.compose)`):

```kotlin
    // Hilt Worker
    implementation(libs.androidx.hilt.work)
    ksp(libs.androidx.hilt.work) // hilt-work includes its own annotation processor
```

Wait — `hilt-work` does NOT need a separate KSP processor. The Hilt compiler already handles `@HiltWorker`. Correct dependency:

```kotlin
    // Hilt Worker (for @HiltWorker support)
    implementation(libs.androidx.hilt.work)
```

**Step 3: Verify build compiles**

Run (from Android Studio or command line):
```bash
cd apps/mobile && ./gradlew compileDebugKotlin
```
Expected: BUILD SUCCESSFUL (no new errors).

**Step 4: Commit**

```bash
git add apps/mobile/gradle/libs.versions.toml apps/mobile/app/build.gradle.kts
git commit -m "chore(mobile): add hilt-work dependency for @HiltWorker support"
```

---

### Task 3: Android — Create SyncRetryWorker

**Files:**
- Create: `apps/mobile/app/src/main/java/com/hart/notimgmt/data/sync/SyncRetryWorker.kt`

**Step 1: Create the worker**

```kotlin
package com.hart.notimgmt.data.sync

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.hart.notimgmt.data.db.dao.CapturedMessageDao
import com.hart.notimgmt.data.supabase.SupabaseDataSource
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import io.github.jan.supabase.auth.Auth

@HiltWorker
class SyncRetryWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val messageDao: CapturedMessageDao,
    private val supabaseDataSource: SupabaseDataSource,
    private val auth: Auth
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME = "sync_retry"
        private const val TAG = "SyncRetryWorker"
    }

    override suspend fun doWork(): Result {
        if (auth.currentUserOrNull() == null) {
            Log.w(TAG, "Not logged in, retrying later")
            return Result.retry()
        }

        val pending = messageDao.getPendingSync()
        if (pending.isEmpty()) {
            Log.d(TAG, "No pending messages to sync")
            return Result.success()
        }

        Log.d(TAG, "Syncing ${pending.size} pending messages")
        var allSuccess = true
        for (msg in pending) {
            try {
                supabaseDataSource.upsertMessage(msg)
                messageDao.markSynced(msg.id)
                Log.d(TAG, "Synced: ${msg.id}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync ${msg.id}: ${e.message}", e)
                allSuccess = false
            }
        }

        return if (allSuccess) Result.success() else Result.retry()
    }
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/data/sync/SyncRetryWorker.kt
git commit -m "feat(mobile): add SyncRetryWorker for automatic sync retry"
```

---

### Task 4: Android — Configure HiltWorkerFactory in NotiFlowApp

The existing `ModelDownloadWorker` does NOT use `@HiltWorker`, so there's no `Configuration.Provider` yet. We need to add it so `@HiltWorker` classes get their dependencies injected.

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/NotiFlowApp.kt`

**Step 1: Update NotiFlowApp to implement Configuration.Provider**

Replace the entire file content with:

```kotlin
package com.hart.notimgmt

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class NotiFlowApp : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
```

**Step 2: Disable default WorkManager initializer in AndroidManifest**

Open `apps/mobile/app/src/main/AndroidManifest.xml`. Inside the `<application>` tag, add this `<provider>` to remove the default initializer (so our custom `Configuration.Provider` is used):

```xml
        <!-- Disable default WorkManager initializer (we use HiltWorkerFactory) -->
        <provider
            android:name="androidx.startup.InitializationProvider"
            android:authorities="${applicationId}.androidx-startup"
            android:exported="false"
            tools:node="merge">
            <meta-data
                android:name="androidx.work.WorkManagerInitializer"
                android:value="androidx.startup"
                tools:node="remove" />
        </provider>
```

Make sure the `<manifest>` root tag includes `xmlns:tools="http://schemas.android.com/tools"`.

**Step 3: Verify build compiles**

```bash
cd apps/mobile && ./gradlew compileDebugKotlin
```
Expected: BUILD SUCCESSFUL.

**Step 4: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/NotiFlowApp.kt apps/mobile/app/src/main/AndroidManifest.xml
git commit -m "feat(mobile): configure HiltWorkerFactory for @HiltWorker support"
```

---

### Task 5: Android — Wire SyncRetryWorker into SyncManager

When `syncMessage()` fails, enqueue a `SyncRetryWorker`. Also add heartbeat throttle.

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/data/sync/SyncManager.kt`

**Step 1: Add WorkManager import and constructor parameter**

Add to the `SyncManager` constructor (after `private val realtime: Realtime`):

```kotlin
    private val workManager: WorkManager
```

Add these imports at the top:

```kotlin
import androidx.work.WorkManager
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.BackoffPolicy
import androidx.work.ExistingWorkPolicy
import java.util.concurrent.TimeUnit
```

**Step 2: Add heartbeat throttle field**

After `private var channelSubscribed = false` (line 106), add:

```kotlin
    private var lastDeviceUpdateMs = 0L
    private val DEVICE_UPDATE_THROTTLE_MS = 60_000L  // 1 minute
```

**Step 3: Add `scheduleSyncRetry()` method**

After `syncPendingMessages()` method (after line 765), add:

```kotlin
    private fun scheduleSyncRetry() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<SyncRetryWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        workManager.enqueueUniqueWork(
            SyncRetryWorker.WORK_NAME,
            ExistingWorkPolicy.KEEP,  // Don't replace if already queued
            request
        )
        Log.d(TAG, "Sync retry worker scheduled")
    }
```

**Step 4: Add `updateHeartbeatThrottled()` method**

After `scheduleSyncRetry()`, add:

```kotlin
    private suspend fun updateHeartbeatThrottled() {
        val now = System.currentTimeMillis()
        if (now - lastDeviceUpdateMs < DEVICE_UPDATE_THROTTLE_MS) return
        try {
            registerDevice()
            lastDeviceUpdateMs = now
        } catch (e: Exception) {
            Log.e(TAG, "Heartbeat update failed (non-blocking): ${e.message}")
        }
    }
```

**Step 5: Modify `syncMessage()` to schedule retry on failure + update heartbeat**

Replace the existing `syncMessage()` method (lines 646-662) with:

```kotlin
    suspend fun syncMessage(message: CapturedMessageEntity) {
        capturedMessageDao.markNeedsSync(message.id)

        if (!isUserLoggedIn()) {
            Log.w(TAG, "Message sync deferred (not logged in): ${message.id}")
            scheduleSyncRetry()
            return
        }
        try {
            supabaseDataSource.upsertMessage(message)
            capturedMessageDao.markSynced(message.id)
            Log.d(TAG, "Message synced: ${message.id}")
            updateHeartbeatThrottled()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync message (will retry): ${e.message}", e)
            addLog("❌ 메시지 동기화 실패 (재시도 예정): ${e.message}")
            scheduleSyncRetry()
        }
    }
```

**Step 6: Make `syncPendingMessages()` public**

Change visibility from `private` to `internal` (needed by the Realtime handler):

```kotlin
    internal suspend fun syncPendingMessages() {
```

**Step 7: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/data/sync/SyncManager.kt
git commit -m "feat(mobile): wire SyncRetryWorker into SyncManager with heartbeat throttle"
```

---

### Task 6: Android — Add `mobile_devices` Realtime Subscription

When the web dashboard sets `sync_requested_at`, the mobile app detects this via Realtime and runs `syncPendingMessages()`.

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/data/sync/SyncManager.kt`
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/data/supabase/SupabaseDataSource.kt`

**Step 1: Add `sync_requested_at` to `MobileDeviceDto`**

In `SupabaseDataSource.kt`, update `MobileDeviceDto` (around line 626):

```kotlin
@Serializable
data class MobileDeviceDto(
    val id: String,
    val user_id: String,
    val device_name: String,
    val device_model: String? = null,
    val app_version: String,
    val os_version: String,
    val platform: String = "android",
    val last_sync_at: String? = null,
    val sync_requested_at: String? = null
)
```

**Step 2: Add `mobile_devices` Realtime subscription in SyncManager**

In `subscribeToRealtimeChanges()` (SyncManager.kt, inside the `try` block, before `channel.subscribe()`), add:

```kotlin
            // Mobile devices changes (sync trigger from web dashboard)
            channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                table = SupabaseDataSource.MOBILE_DEVICES_TABLE
            }.onEach { action ->
                handleMobileDeviceChange(action, userId)
            }.launchIn(scope)
```

**Step 3: Add the handler method**

After the last `handleDayCategoryChange()` method (around line 1026), add:

```kotlin
    private suspend fun handleMobileDeviceChange(action: PostgresAction, currentUserId: String) {
        try {
            when (action) {
                is PostgresAction.Update -> {
                    val dto = json.decodeFromJsonElement<MobileDeviceDto>(action.record)
                    if (dto.user_id != currentUserId) return
                    // Check if this is our device by matching the device ID pattern
                    val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                    val myDeviceId = "${currentUserId}_${androidId}"
                    if (dto.id != myDeviceId) return

                    // sync_requested_at changed → run pending sync
                    if (dto.sync_requested_at != null) {
                        Log.d(TAG, "Remote sync request received from web dashboard")
                        addLog("🔄 웹 대시보드에서 동기화 요청 수신")
                        syncPendingMessages()
                        updateHeartbeatThrottled()
                    }
                }
                else -> {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling mobile device change", e)
        }
    }
```

**Step 4: Add `@Suppress("HardwareIds")` to `handleMobileDeviceChange`**

The method accesses `ANDROID_ID`, so add the suppression:

```kotlin
    @Suppress("HardwareIds")
    private suspend fun handleMobileDeviceChange(action: PostgresAction, currentUserId: String) {
```

**Step 5: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/data/sync/SyncManager.kt apps/mobile/app/src/main/java/com/hart/notimgmt/data/supabase/SupabaseDataSource.kt
git commit -m "feat(mobile): subscribe to mobile_devices Realtime for web sync trigger"
```

---

### Task 7: Web — Add `sync_requested_at` to TypeScript Type

**Files:**
- Modify: `apps/web/src/lib/types.ts`

**Step 1: Add field to MobileDevice interface**

In the `MobileDevice` interface, add after `last_sync_at: string;`:

```typescript
  sync_requested_at: string | null;
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(web): add sync_requested_at to MobileDevice type"
```

---

### Task 8: Web — Add `requestDeviceSync` Server Action

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

**Step 1: Add the server action**

After the existing `updateDevice` function (around line 237), add:

```typescript
export async function requestDeviceSync(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mobile_devices")
    .update({ sync_requested_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/devices");
  return { success: true };
}

export async function requestAllDevicesSync() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mobile_devices")
    .update({ sync_requested_at: new Date().toISOString() })
    .eq("is_active", true);
  if (error) throw error;
  revalidatePath("/devices");
  return { success: true };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(web): add requestDeviceSync server actions"
```

---

### Task 9: Web — Update Device Query to Include `sync_requested_at`

**Files:**
- Modify: `apps/web/src/lib/queries/devices.ts`

**Step 1: Add `sync_requested_at` to the mapping**

In the `getDevices()` function, in the `.map(row => ({...}))` block, add:

```typescript
    sync_requested_at: row.sync_requested_at,
```

After the `last_sync_at` line.

**Step 2: Commit**

```bash
git add apps/web/src/lib/queries/devices.ts
git commit -m "feat(web): include sync_requested_at in device query"
```

---

### Task 10: Web — Add Sync Buttons to Device List

**Files:**
- Modify: `apps/web/src/components/device-list.tsx`
- Modify: `apps/web/src/app/(dashboard)/devices/page.tsx`

**Step 1: Add imports and sync action to device-list.tsx**

At the top of `device-list.tsx`, add to imports:

```typescript
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestDeviceSync } from "@/lib/actions";
```

**Step 2: Add sync column to table header**

After the `is_active` `ResizableTh` (around line 170-172), add a new column header:

```tsx
            <th className="w-[60px] px-2 text-center text-xs font-medium text-muted-foreground">
              동기화
            </th>
```

Also add `sync: 60` to `COL_DEFAULTS` object.

**Step 3: Add sync button to each row**

After the `Switch` `TableCell` (around line 226-233), add:

```tsx
              <TableCell className="text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={isPending || !d.is_active}
                      onClick={() => handleRequestSync(d)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>보류 메시지 동기화 요청</TooltipContent>
                </Tooltip>
              </TableCell>
```

**Step 4: Add the handler function**

After `handleToggleActive` (around line 129), add:

```typescript
  function handleRequestSync(device: MobileDevice) {
    startTransition(async () => {
      try {
        await requestDeviceSync(device.id);
        toast.success(`${device.device_name} 기기에 동기화 요청을 보냈습니다.`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "동기화 요청 실패";
        toast.error(msg);
      }
    });
  }
```

**Step 5: Add "전체 동기화" button to devices/page.tsx**

In `apps/web/src/app/(dashboard)/devices/page.tsx`, update the header area. Change:

```tsx
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">모바일 기기 관리</h1>
      </div>
```

To:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">모바일 기기 관리</h1>
        <SyncAllButton />
      </div>
```

And create a client component `SyncAllButton` either inline or as a small component. The simplest approach is a separate small client component at the bottom of `device-list.tsx`:

```typescript
export function SyncAllButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSyncAll() {
    startTransition(async () => {
      try {
        const { requestAllDevicesSync } = await import("@/lib/actions");
        await requestAllDevicesSync();
        toast.success("모든 활성 기기에 동기화 요청을 보냈습니다.");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "동기화 요청 실패";
        toast.error(msg);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleSyncAll}>
      <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
      전체 동기화
    </Button>
  );
}
```

Update imports in `devices/page.tsx`:

```typescript
import { DeviceTable, SyncAllButton } from "@/components/device-list";
```

**Step 6: Verify build**

```bash
cd apps/web && npm run build
```
Expected: Build succeeds with no errors.

**Step 7: Commit**

```bash
git add apps/web/src/components/device-list.tsx "apps/web/src/app/(dashboard)/devices/page.tsx"
git commit -m "feat(web): add per-device and bulk sync buttons to device management"
```

---

### Task 11: Deploy and Verify

**Step 1: Push all commits**

```bash
git push
```

**Step 2: Deploy web to Vercel**

```bash
cd apps/web && npx vercel --prod
```

**Step 3: Apply Supabase migration (if not done in Task 1)**

```bash
cd packages/supabase && npx supabase db push --linked
```

**Step 4: Test flow**

1. Open web dashboard `/devices` — verify sync buttons appear
2. Click sync button on a device row — verify `sync_requested_at` updates in Supabase
3. Build and run mobile app in Android Studio
4. Capture a test notification — verify message syncs to Supabase immediately
5. Disable WiFi, capture another notification, re-enable WiFi — verify WorkManager retries and message syncs
6. Click web "전체 동기화" — verify mobile receives Realtime trigger and syncs

**Step 5: Final commit with release notes**

```bash
git add -A
git commit -m "docs: update release notes with sync reliability improvements"
git push
```

---

## Summary of All Changes

| # | Area | File | Action |
|---|---|---|---|
| 1 | Supabase | `migrations/00015_device_sync_requested.sql` | Create |
| 2 | Mobile | `gradle/libs.versions.toml` | Add `hilt-work` |
| 2 | Mobile | `app/build.gradle.kts` | Add `hilt-work` dep |
| 3 | Mobile | `data/sync/SyncRetryWorker.kt` | Create |
| 4 | Mobile | `NotiFlowApp.kt` | Add `Configuration.Provider` |
| 4 | Mobile | `AndroidManifest.xml` | Disable default WM init |
| 5 | Mobile | `data/sync/SyncManager.kt` | Add retry + heartbeat |
| 6 | Mobile | `data/sync/SyncManager.kt` | Add Realtime handler |
| 6 | Mobile | `data/supabase/SupabaseDataSource.kt` | `sync_requested_at` in DTO |
| 7 | Web | `lib/types.ts` | Add `sync_requested_at` |
| 8 | Web | `lib/actions.ts` | Add sync actions |
| 9 | Web | `lib/queries/devices.ts` | Include new field |
| 10 | Web | `components/device-list.tsx` | Sync buttons |
| 10 | Web | `app/(dashboard)/devices/page.tsx` | Bulk sync button |
