package com.hart.notimgmt.data.sync

import android.content.Context
import android.provider.Settings
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.hart.notimgmt.data.db.dao.CapturedMessageDao
import com.hart.notimgmt.data.supabase.SupabaseDataSource
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.exception.PostgrestRestException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull

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
        private const val MAX_RETRY_ATTEMPTS = 5
    }

    @Suppress("HardwareIds")
    private fun getDeviceId(): String? {
        val userId = auth.currentUserOrNull()?.id ?: return null
        val androidId = Settings.Secure.getString(applicationContext.contentResolver, Settings.Secure.ANDROID_ID)
        return "${userId}_${androidId}"
    }

    override suspend fun doWork(): Result {
        // 최대 재시도 횟수 초과 시 포기
        if (runAttemptCount >= MAX_RETRY_ATTEMPTS) {
            Log.w(TAG, "Max retry attempts ($MAX_RETRY_ATTEMPTS) reached, giving up")
            return Result.failure()
        }

        // 세션이 디스크에서 로딩 완료될 때까지 최대 30초 대기
        val sessionStatus = withTimeoutOrNull(30_000L) {
            auth.sessionStatus.first { it !is SessionStatus.Initializing }
        }
        if (sessionStatus !is SessionStatus.Authenticated) {
            Log.w(TAG, "Not logged in (status: $sessionStatus), retrying later")
            return Result.retry()
        }

        val pending = messageDao.getPendingSync()
        if (pending.isEmpty()) {
            Log.d(TAG, "No pending messages to sync")
            return Result.success()
        }

        val deviceId = getDeviceId()
        Log.d(TAG, "Syncing ${pending.size} pending messages (attempt ${runAttemptCount + 1}/$MAX_RETRY_ATTEMPTS, deviceId=$deviceId)")
        var successCount = 0
        var permanentFailCount = 0
        for (msg in pending) {
            try {
                supabaseDataSource.upsertMessage(msg, deviceId)
                messageDao.markSynced(msg.id)
                successCount++
                Log.d(TAG, "Synced: ${msg.id}")
            } catch (e: PostgrestRestException) {
                // Postgrest 에러: error 메시지로 영구 실패 여부 판단
                val errorMsg = e.error
                val isPermanent = errorMsg.contains("violates", ignoreCase = true) ||
                    errorMsg.contains("not found", ignoreCase = true) ||
                    errorMsg.contains("permission", ignoreCase = true) ||
                    errorMsg.contains("unauthorized", ignoreCase = true)
                if (isPermanent) {
                    Log.e(TAG, "Permanent error syncing ${msg.id}, clearing needsSync: ${e.message}")
                    messageDao.markSynced(msg.id) // 재시도 방지
                    permanentFailCount++
                } else {
                    Log.e(TAG, "Postgrest error syncing ${msg.id}: ${e.message}", e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync ${msg.id}: ${e.message}", e)
            }
        }

        Log.d(TAG, "Sync result: $successCount success, $permanentFailCount permanent failures out of ${pending.size}")
        return if (successCount + permanentFailCount >= pending.size) Result.success() else Result.retry()
    }
}
