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
import io.github.jan.supabase.auth.status.SessionStatus
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
    }

    override suspend fun doWork(): Result {
        // 세션이 디스크에서 로딩 완료될 때까지 최대 5초 대기
        val sessionStatus = withTimeoutOrNull(5_000L) {
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
