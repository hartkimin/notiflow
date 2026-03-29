package com.hart.notimgmt.data.sync

import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.hart.notimgmt.BuildConfig
import com.hart.notimgmt.data.db.dao.*
import com.hart.notimgmt.data.db.entity.*
import com.hart.notimgmt.data.supabase.*
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.PostgresAction
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.datetime.Instant
import kotlinx.datetime.Clock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement
import com.hart.notimgmt.data.backup.BackupManager
import com.hart.notimgmt.data.db.AppDatabase
import com.hart.notimgmt.data.preferences.AppPreferences
import androidx.room.withTransaction
import java.io.File
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

enum class SyncStatus {
    IDLE,
    SYNCING,
    ERROR
}

/**
 * 테이블별 동기화 상태
 */
enum class TableSyncStatus {
    PENDING,    // 대기 중
    PULLING,    // 서버에서 가져오는 중
    PUSHING,    // 서버로 업로드 중
    COMPLETED,  // 완료
    ERROR       // 에러
}

/**
 * 테이블 동기화 정보
 */
data class TableSyncInfo(
    val tableName: String,
    val displayName: String,
    val status: TableSyncStatus = TableSyncStatus.PENDING,
    val pulledCount: Int = 0,
    val pushedCount: Int = 0,
    val errorMessage: String? = null
)

/**
 * 전체 동기화 상태
 */
data class SyncState(
    val overallStatus: SyncStatus = SyncStatus.IDLE,
    val tables: List<TableSyncInfo> = listOf(
        TableSyncInfo("categories", "카테고리"),
        TableSyncInfo("status_steps", "상태 단계"),
        TableSyncInfo("filter_rules", "필터 규칙"),
        TableSyncInfo("captured_messages", "메시지"),
        TableSyncInfo("app_filters", "앱 필터"),
        TableSyncInfo("plans", "플랜"),
        TableSyncInfo("day_categories", "일별 카테고리")
    ),
    val syncLogs: List<String> = emptyList(),
    val lastSyncAt: Long = 0L,
    val lastErrorMessage: String? = null
)

data class UploadOptions(
    val categories: Boolean = true,    // 카테고리 + 필터 규칙 (FK로 그룹)
    val statusSteps: Boolean = true,   // 상태 단계
    val messages: Boolean = true,      // 메시지
    val appFilters: Boolean = true,    // 앱 필터
    val plans: Boolean = true,         // 스케줄
    val dayCategories: Boolean = true  // 요일 카테고리
)

data class DownloadOptions(
    val categories: Boolean = true,    // 카테고리 + 필터 규칙 (FK로 그룹)
    val statusSteps: Boolean = true,   // 상태 단계
    val messages: Boolean = true,      // 메시지
    val appFilters: Boolean = true,    // 앱 필터
    val plans: Boolean = true,         // 스케줄
    val dayCategories: Boolean = true  // 요일 카테고리
)

@Singleton
class SyncManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val supabaseDataSource: SupabaseDataSource,
    private val capturedMessageDao: CapturedMessageDao,
    private val categoryDao: CategoryDao,
    private val filterRuleDao: FilterRuleDao,
    private val statusStepDao: StatusStepDao,
    private val appFilterDao: AppFilterDao,
    private val planDao: PlanDao,
    private val dayCategoryDao: DayCategoryDao,
    private val auth: Auth,
    private val realtime: Realtime,
    private val workManager: WorkManager,
    private val appPreferences: AppPreferences,
    private val db: AppDatabase,
    private val backupManager: BackupManager
) {
    companion object {
        private const val TAG = "SyncManager"
        private const val MAX_LOGS = 50
    }

    private val isCloudMode: Boolean
        get() = appPreferences.isCloudMode

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    private val _syncStatus = MutableStateFlow(SyncStatus.IDLE)
    val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    private val _syncState = MutableStateFlow(SyncState(lastSyncAt = appPreferences.lastSyncAt))
    val syncState: StateFlow<SyncState> = _syncState.asStateFlow()

    private var isListening = false
    private val channelSubscribed = AtomicBoolean(false)
    private var lastDeviceUpdateMs = 0L
    private val DEVICE_UPDATE_THROTTLE_MS = 60_000L

    /**
     * 앱 재설치 후 서버에 기존 설정이 있을 때 복원 제안 상태.
     * null = 아직 체크 안됨, non-null = 서버에 데이터 존재 (복원 가능)
     */
    private val _restoreAvailable = MutableStateFlow<com.hart.notimgmt.data.backup.DataSummary?>(null)
    val restoreAvailable: StateFlow<com.hart.notimgmt.data.backup.DataSummary?> = _restoreAvailable.asStateFlow()

    private val _isRestoring = MutableStateFlow(false)
    val isRestoring: StateFlow<Boolean> = _isRestoring.asStateFlow()

    fun dismissRestorePrompt() {
        _restoreAvailable.value = null
        appPreferences.hasEverSynced = true
    }

    /**
     * 현재 기기의 고유 ID를 반환 ({userId}_{androidId}).
     * 로그인되지 않은 경우 null.
     */
    fun getMyDeviceId(): String? {
        val userId = auth.currentUserOrNull()?.id ?: return null
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        return "${userId}_${androidId}"
    }

    private fun addLog(message: String) {
        Log.d(TAG, message)
        val currentState = _syncState.value
        val newLogs = (listOf("[${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())}] $message") + currentState.syncLogs).take(MAX_LOGS)
        _syncState.value = currentState.copy(syncLogs = newLogs)
    }

    private fun updateTableStatus(tableName: String, status: TableSyncStatus, pulledCount: Int? = null, pushedCount: Int? = null, errorMessage: String? = null) {
        val currentState = _syncState.value
        val updatedTables = currentState.tables.map { table ->
            if (table.tableName == tableName) {
                table.copy(
                    status = status,
                    pulledCount = pulledCount ?: table.pulledCount,
                    pushedCount = pushedCount ?: table.pushedCount,
                    errorMessage = errorMessage
                )
            } else table
        }
        _syncState.value = currentState.copy(tables = updatedTables)
    }

    private fun resetTableStatuses() {
        _syncState.value = SyncState(lastSyncAt = appPreferences.lastSyncAt)
    }

    private suspend fun markSyncSuccess() {
        val now = System.currentTimeMillis()
        appPreferences.lastSyncAt = now
        appPreferences.hasEverSynced = true
        _syncStatus.value = SyncStatus.IDLE
        _syncState.value = _syncState.value.copy(
            overallStatus = SyncStatus.IDLE,
            lastSyncAt = now,
            lastErrorMessage = null
        )

        // Update last_sync_at on the remote mobile_devices table
        val userId = auth.currentUserOrNull()?.id
        if (userId != null) {
            val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            val myDeviceId = "${userId}_${androidId}"
            try {
                val isoNow = Instant.fromEpochMilliseconds(now).toString()
                supabaseDataSource.updateLastSyncAt(myDeviceId, isoNow)
                Log.d(TAG, "Remote last_sync_at updated to: $isoNow")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update remote last_sync_at", e)
            }
        }
    }

    private fun markSyncError(message: String?) {
        _syncStatus.value = SyncStatus.ERROR
        _syncState.value = _syncState.value.copy(
            overallStatus = SyncStatus.ERROR,
            lastErrorMessage = message
        )
    }

    /**
     * 원격 서버의 데이터 건수를 조회 (다운로드 선택 다이얼로그용)
     */
    suspend fun getRemoteDataSummary(): com.hart.notimgmt.data.backup.DataSummary {
        val categories = try { supabaseDataSource.getCategories() } catch (_: Exception) { emptyList() }
        val filterRules = try { supabaseDataSource.getFilterRules() } catch (_: Exception) { emptyList() }
        val statusSteps = try { supabaseDataSource.getStatusSteps() } catch (_: Exception) { emptyList() }
        val messages = try { supabaseDataSource.getMessages() } catch (_: Exception) { emptyList() }
        val appFilters = try { supabaseDataSource.getAppFilters() } catch (_: Exception) { emptyList() }
        val plans = try { supabaseDataSource.getPlans() } catch (_: Exception) { emptyList() }
        val dayCategories = try { supabaseDataSource.getDayCategories() } catch (_: Exception) { emptyList() }
        return com.hart.notimgmt.data.backup.DataSummary(
            categoryCount = categories.size,
            statusStepCount = statusSteps.size,
            filterRuleCount = filterRules.size,
            messageCount = messages.size,
            appFilterCount = appFilters.size,
            planCount = plans.size,
            dayCategoryCount = dayCategories.size
        )
    }

    /**
     * ERROR 상태를 IDLE로 리셋 (설정 화면 재진입 시 호출)
     */
    fun clearErrorIfStale() {
        if (_syncStatus.value == SyncStatus.ERROR) {
            _syncStatus.value = SyncStatus.IDLE
            _syncState.value = _syncState.value.copy(
                overallStatus = SyncStatus.IDLE,
                lastErrorMessage = null
            )
        }
    }

    @Suppress("HardwareIds")
    private suspend fun registerDevice() {
        val userId = auth.currentUserOrNull()?.id ?: return
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        val dto = MobileDeviceDto(
            id = "${userId}_${androidId}",
            user_id = userId,
            device_name = Build.MODEL,
            device_model = "${Build.MANUFACTURER} ${Build.MODEL}",
            app_version = BuildConfig.VERSION_NAME,
            os_version = Build.VERSION.RELEASE,
            fcm_token = appPreferences.fcmToken,
            last_sync_at = java.time.Instant.now().toString()
        )
        supabaseDataSource.upsertMobileDevice(dto)
    }

    /**
     * 수동 동기화 (업로드 전용 — 로컬 → 원격)
     * @param clearRequest 웹 대시보드에서 요청한 동기화 플래그(sync_requested_at)를 클리어할지 여부
     */
    fun forceSync(clearRequest: Boolean = false) {
        if (!isCloudMode) { addLog("⚠️ 오프라인 모드"); return }

        if (_syncStatus.value == SyncStatus.SYNCING) {
            addLog("⚠️ 동기화가 이미 진행 중입니다")
            return
        }

        scope.launch {
            try {
                // 세션 복원 대기 (최대 30초) — 앱 시작 직후 호출 시 race condition 방지
                if (!awaitUserLoggedIn()) {
                    addLog("❌ 로그인이 필요합니다")
                    return@launch
                }
                val userId = auth.currentUserOrNull()?.id ?: run {
                    addLog("❌ 로그인이 필요합니다")
                    return@launch
                }

                if (clearRequest) {
                    val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                    val myDeviceId = "${userId}_${androidId}"
                    try {
                        supabaseDataSource.clearSyncRequest(myDeviceId)
                        Log.d(TAG, "Cleared sync_requested_at via forceSync(clearRequest=true)")
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to clear sync_requested_at in forceSync", e)
                    }
                }
                initialSync()
                if (!channelSubscribed.get()) {
                    subscribeToRealtimeChanges(userId)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Force sync failed", e)
                addLog("❌ 동기화 실패: ${e.message}")
                markSyncError(e.message)
            }
        }
    }

    /**
     * 업로드 전용 (로컬 → 원격)
     */
    fun forceUpload(options: UploadOptions = UploadOptions()) {
        if (!isCloudMode) { addLog("⚠️ 오프라인 모드"); return }
        if (_syncStatus.value == SyncStatus.SYNCING) {
            addLog("⚠️ 동기화가 이미 진행 중입니다")
            return
        }
        scope.launch {
            if (!awaitUserLoggedIn()) {
                addLog("❌ 로그인이 필요합니다")
                return@launch
            }
            _syncStatus.value = SyncStatus.SYNCING
            _syncState.value = _syncState.value.copy(overallStatus = SyncStatus.SYNCING)
            resetTableStatuses()
            try {
                addLog("업로드 시작...")
                syncPush(options)
                if (options.messages) {
                    syncPendingMessages()
                    syncPendingDeletions()
                }
                markSyncSuccess()
                addLog("✅ 업로드 완료!")
            } catch (e: Exception) {
                Log.e(TAG, "Upload sync failed", e)
                addLog("❌ 업로드 실패: ${e.message}")
                markSyncError(e.message)
            }
        }
    }

    /**
     * 복원 전용 (원격 → 로컬). 데이터 복구 시에만 사용.
     * @param cleanRestore true이면 로컬 전용 레코드를 삭제하고 서버 상태로 완전 복원
     */
    fun forceDownload(options: DownloadOptions = DownloadOptions(), cleanRestore: Boolean = false) {
        if (!isCloudMode) { addLog("⚠️ 오프라인 모드"); return }
        if (_syncStatus.value == SyncStatus.SYNCING) {
            addLog("⚠️ 동기화가 이미 진행 중입니다")
            return
        }
        scope.launch {
            if (!awaitUserLoggedIn()) {
                addLog("❌ 로그인이 필요합니다")
                return@launch
            }
            _isRestoring.value = true
            _syncStatus.value = SyncStatus.SYNCING
            _syncState.value = _syncState.value.copy(overallStatus = SyncStatus.SYNCING)
            resetTableStatuses()
            try {
                // 복원 전 자동 백업
                try {
                    val backupJson = backupManager.exportToJson()
                    val backupFile = File(context.filesDir, "auto_backup_before_restore.json")
                    backupFile.writeText(backupJson)
                    addLog("✓ 복원 전 자동 백업 완료")
                } catch (e: Exception) {
                    Log.e(TAG, "Auto-backup before restore failed", e)
                    addLog("⚠️ 자동 백업 실패 (복원은 계속 진행)")
                }

                addLog("복원 시작...")
                syncPull(options, cleanRestore = cleanRestore)
                markSyncSuccess()
                addLog("✅ 복원 완료!")
            } catch (e: Exception) {
                Log.e(TAG, "Download sync failed", e)
                addLog("❌ 복원 실패: ${e.message}")
                markSyncError(e.message)
            } finally {
                _isRestoring.value = false
            }
        }
    }

    /**
     * 동기화 시작 (로그인 후 호출) — 업로드 전용
     */
    fun startListening() {
        if (!isCloudMode) return
        if (isListening) {
            Log.d(TAG, "Skipping startListening: already listening")
            return
        }

        isListening = true

        scope.launch {
            try {
                // 세션 복원 대기 — 앱 시작 직후 호출 시 race condition 방지
                if (!awaitUserLoggedIn()) {
                    Log.w(TAG, "startListening aborted: not logged in after waiting")
                    isListening = false
                    return@launch
                }
                val userId = auth.currentUserOrNull()?.id
                Log.d(TAG, "Starting upload sync for user: $userId")
                initialSync()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start sync", e)
                _syncStatus.value = SyncStatus.ERROR
            }
        }
    }

    private suspend fun initialSync() {
        // 앱 재설치 감지: hasEverSynced가 false이면 서버에 데이터가 있는지 확인
        if (!appPreferences.hasEverSynced) {
            try {
                val remoteSummary = getRemoteDataSummary()
                if (remoteSummary.totalCount > 0) {
                    addLog("서버에 기존 설정 발견 (${remoteSummary.totalCount}건). 복원 대기 중...")
                    _restoreAvailable.value = remoteSummary
                    return  // 업로드하지 않고 복원 선택 대기
                }
                // 서버에 데이터 없음 → 첫 설치로 간주
                appPreferences.hasEverSynced = true
            } catch (e: Exception) {
                Log.e(TAG, "Restore check failed, proceeding with normal sync: ${e.message}")
            }
        }

        _syncStatus.value = SyncStatus.SYNCING
        _syncState.value = _syncState.value.copy(overallStatus = SyncStatus.SYNCING)
        resetTableStatuses()
        addLog("업로드 동기화 시작...")

        var hasError = false
        var lastErrorMessage: String? = null
        try {
            syncPush()
        } catch (e: Exception) {
            Log.e(TAG, "Push sync failed: ${e.message}", e)
            addLog("⚠️ 데이터 업로드 중 일부 실패: ${e.message}")
            hasError = true
            lastErrorMessage = e.message
        }
        try {
            syncPendingMessages()
        } catch (e: Exception) {
            Log.e(TAG, "Pending messages sync failed: ${e.message}", e)
            hasError = true
            lastErrorMessage = e.message
        }
        try {
            syncPendingDeletions()
        } catch (e: Exception) {
            Log.e(TAG, "Pending deletions sync failed: ${e.message}", e)
            hasError = true
            lastErrorMessage = e.message
        }
        registerDeviceSilently()

        if (hasError) {
            addLog("❌ 동기화 실패 (일부 오류 발생, 다음 동기화 시 재시도): $lastErrorMessage")
            markSyncError(lastErrorMessage)
            scheduleSyncRetry()
        } else {
            markSyncSuccess()
            addLog("✅ 업로드 완료!")
        }
    }

    /**
     * FCM 토큰 갱신 시 호출 — 기기 정보를 Supabase에 재등록
     */
    fun refreshDeviceRegistration() {
        scope.launch {
            try {
                registerDevice()
                Log.d(TAG, "Device re-registered with new FCM token")
            } catch (e: Exception) {
                Log.e(TAG, "FCM token re-registration failed: ${e.message}", e)
            }
        }
    }

    private fun registerDeviceSilently() {
        scope.launch {
            var lastError: Exception? = null
            for (attempt in 1..3) {
                try {
                    registerDevice()
                    addLog("✓ 기기 정보 등록 완료")
                    return@launch
                } catch (e: Exception) {
                    lastError = e
                    Log.e(TAG, "Device registration attempt $attempt/3 failed: ${e.message}", e)
                    if (attempt < 3) kotlinx.coroutines.delay(attempt * 2000L)
                }
            }
            Log.e(TAG, "Device registration failed after 3 attempts: ${lastError?.message}")
            addLog("⚠️ 기기 등록 실패 (다음 동기화 시 재시도)")
        }
    }

    /**
     * Pull: 원격 → 로컬 (선택된 테이블만)
     * @param cleanRestore true이면 각 테이블의 로컬 레코드를 삭제한 후 원격 데이터를 삽입 (서버 상태로 완전 복원)
     */
    private suspend fun syncPull(options: DownloadOptions = DownloadOptions(), cleanRestore: Boolean = false) {
      db.withTransaction {
        // cleanRestore: 로컬 전용 레코드 정리 (서버 상태로 완전 복원)
        if (cleanRestore) {
            addLog("클린 복원 모드: 로컬 데이터 정리 중...")
            // FK 순서 준수: 자식 테이블 먼저 삭제
            if (options.messages) capturedMessageDao.deleteAll()
            if (options.plans) planDao.deleteAll()
            if (options.dayCategories) dayCategoryDao.deleteAll()
            if (options.categories) {
                filterRuleDao.deleteAll()
                dayCategoryDao.deleteAll()
                categoryDao.deleteAll()
            }
            if (options.statusSteps) statusStepDao.deleteAll()
            if (options.appFilters) appFilterDao.deleteAll()
            addLog("✓ 로컬 데이터 정리 완료")
        }

        // ── 카테고리 ──
        if (options.categories) {
            addLog("카테고리 가져오는 중...")
            updateTableStatus("categories", TableSyncStatus.PULLING)
            val remoteCategories = try {
                supabaseDataSource.getCategories()
            } catch (e: Exception) {
                addLog("❌ 카테고리 가져오기 실패: ${e.message}")
                updateTableStatus("categories", TableSyncStatus.ERROR, errorMessage = e.message)
                emptyList()
            }
            var categoryPullCount = 0
            remoteCategories.forEach { dto ->
                val local = categoryDao.getById(dto.id)
                if (local == null || dto.updated_at > local.updatedAt) {
                    categoryDao.upsert(dto.toEntity())
                    categoryPullCount++
                }
            }
            addLog("✓ 카테고리 ${remoteCategories.size}개 확인, ${categoryPullCount}개 업데이트")
            updateTableStatus("categories", TableSyncStatus.COMPLETED, pulledCount = categoryPullCount)

            // 필터 규칙 (카테고리와 그룹)
            addLog("필터 규칙 가져오는 중...")
            updateTableStatus("filter_rules", TableSyncStatus.PULLING)
            val remoteFilterRules = try {
                supabaseDataSource.getFilterRules()
            } catch (e: Exception) {
                addLog("❌ 필터 규칙 가져오기 실패: ${e.message}")
                updateTableStatus("filter_rules", TableSyncStatus.ERROR, errorMessage = e.message)
                emptyList()
            }
            val validCategoryIdsForRules = categoryDao.getAllOnce().map { it.id }.toSet()
            var rulePullCount = 0
            var ruleSkipCount = 0
            remoteFilterRules.forEach { dto ->
                if (dto.category_id !in validCategoryIdsForRules) {
                    ruleSkipCount++
                    return@forEach
                }
                val local = filterRuleDao.getById(dto.id)
                if (local == null || dto.updated_at > local.updatedAt) {
                    filterRuleDao.upsert(dto.toEntity())
                    rulePullCount++
                }
            }
            if (ruleSkipCount > 0) {
                addLog("⚠️ 필터 규칙 ${ruleSkipCount}개 건너뜀 (카테고리 없음)")
            }
            addLog("✓ 필터 규칙 ${remoteFilterRules.size}개 확인, ${rulePullCount}개 업데이트")
            updateTableStatus("filter_rules", TableSyncStatus.COMPLETED, pulledCount = rulePullCount)
        } else {
            updateTableStatus("categories", TableSyncStatus.COMPLETED)
            updateTableStatus("filter_rules", TableSyncStatus.COMPLETED)
        }

        // ── 상태 단계 ──
        if (options.statusSteps) {
            addLog("상태 단계 가져오는 중...")
            updateTableStatus("status_steps", TableSyncStatus.PULLING)
            val remoteStatusSteps = try {
                supabaseDataSource.getStatusSteps()
            } catch (e: Exception) {
                addLog("❌ 상태 단계 가져오기 실패: ${e.message}")
                updateTableStatus("status_steps", TableSyncStatus.ERROR, errorMessage = e.message)
                emptyList()
            }
            var stepPullCount = 0
            remoteStatusSteps.forEach { dto ->
                val local = statusStepDao.getById(dto.id)
                if (local == null || dto.updated_at > local.updatedAt) {
                    statusStepDao.upsert(dto.toEntity())
                    stepPullCount++
                }
            }
            addLog("✓ 상태 단계 ${remoteStatusSteps.size}개 확인, ${stepPullCount}개 업데이트")
            updateTableStatus("status_steps", TableSyncStatus.COMPLETED, pulledCount = stepPullCount)
        } else {
            updateTableStatus("status_steps", TableSyncStatus.COMPLETED)
        }

        // ── 메시지 ──
        if (options.messages) {
            addLog("메시지 가져오는 중...")
            updateTableStatus("captured_messages", TableSyncStatus.PULLING)
            val remoteMessages = try {
                supabaseDataSource.getMessages()
            } catch (e: Exception) {
                addLog("❌ 메시지 가져오기 실패: ${e.message}")
                updateTableStatus("captured_messages", TableSyncStatus.ERROR, errorMessage = e.message)
                emptyList()
            }
            val validCategoryIds = categoryDao.getAllOnce().map { it.id }.toSet()
            val validStatusIds = statusStepDao.getAllOnce().map { it.id }.toSet()
            val validRuleIds = filterRuleDao.getAllOnce().map { it.id }.toSet()
            var messagePullCount = 0
            remoteMessages.forEach { dto ->
                val local = capturedMessageDao.getById(dto.id)

                // 영구 삭제 대기 중인 메시지는 건너뜀
                if (local?.pendingPermanentDelete == true) return@forEach

                if (local == null || dto.updated_at > local.updatedAt) {
                    val entity = dto.toEntity().copy(
                        categoryId = if (dto.category_id in validCategoryIds) dto.category_id else null,
                        statusId = if (dto.status_id in validStatusIds) dto.status_id else null,
                        matchedRuleId = if (dto.matched_rule_id in validRuleIds) dto.matched_rule_id else null,
                        needsSync = false
                    )
                    capturedMessageDao.upsert(entity)
                    messagePullCount++
                }
            }
            addLog("✓ 메시지 ${remoteMessages.size}개 확인, ${messagePullCount}개 업데이트")
            updateTableStatus("captured_messages", TableSyncStatus.COMPLETED, pulledCount = messagePullCount)
        } else {
            updateTableStatus("captured_messages", TableSyncStatus.COMPLETED)
        }

        // ── 앱 필터 ──
        if (options.appFilters) {
            addLog("앱 필터 가져오는 중...")
            updateTableStatus("app_filters", TableSyncStatus.PULLING)
            val remoteAppFilters = try {
                supabaseDataSource.getAppFilters()
            } catch (e: Exception) {
                addLog("❌ 앱 필터 가져오기 실패: ${e.message}")
                updateTableStatus("app_filters", TableSyncStatus.ERROR, errorMessage = e.message)
                emptyList()
            }
            var appFilterPullCount = 0
            remoteAppFilters.forEach { dto ->
                val local = appFilterDao.getByPackageName(dto.package_name)
                if (local == null || dto.updated_at > local.updatedAt) {
                    appFilterDao.upsert(dto.toEntity())
                    appFilterPullCount++
                }
            }
            addLog("✓ 앱 필터 ${remoteAppFilters.size}개 확인, ${appFilterPullCount}개 업데이트")
            updateTableStatus("app_filters", TableSyncStatus.COMPLETED, pulledCount = appFilterPullCount)
        } else {
            updateTableStatus("app_filters", TableSyncStatus.COMPLETED)
        }

        // ── 플랜 ──
        if (options.plans) {
            addLog("플랜 가져오는 중...")
            updateTableStatus("plans", TableSyncStatus.PULLING)
            val remotePlans = try {
                supabaseDataSource.getPlans()
            } catch (e: Exception) {
                addLog("❌ 플랜 가져오기 실패: ${e.message}")
                updateTableStatus("plans", TableSyncStatus.ERROR, errorMessage = e.message)
                emptyList()
            }
            val validCategoryIdsForPlans = categoryDao.getAllOnce().map { it.id }.toSet()
            var planPullCount = 0
            remotePlans.forEach { dto ->
                val local = planDao.getById(dto.id)
                if (local == null || dto.updated_at > local.updatedAt) {
                    val entity = dto.toEntity().copy(
                        categoryId = if (dto.category_id in validCategoryIdsForPlans) dto.category_id else null
                    )
                    planDao.upsert(entity)
                    planPullCount++
                }
            }
            addLog("✓ 플랜 ${remotePlans.size}개 확인, ${planPullCount}개 업데이트")
            updateTableStatus("plans", TableSyncStatus.COMPLETED, pulledCount = planPullCount)
        } else {
            updateTableStatus("plans", TableSyncStatus.COMPLETED)
        }

        // ── 일별 카테고리 ──
        if (options.dayCategories) {
            addLog("일별 카테고리 가져오는 중...")
            updateTableStatus("day_categories", TableSyncStatus.PULLING)
            val remoteDayCategories = try {
                supabaseDataSource.getDayCategories()
            } catch (e: Exception) {
                addLog("❌ 일별 카테고리 가져오기 실패: ${e.message}")
                updateTableStatus("day_categories", TableSyncStatus.ERROR, errorMessage = e.message)
                emptyList()
            }
            val validCategoryIdsForDayCats = categoryDao.getAllOnce().map { it.id }.toSet()
            var dayCategoryPullCount = 0
            var dayCategorySkipCount = 0
            remoteDayCategories.forEach { dto ->
                if (dto.category_id !in validCategoryIdsForDayCats) {
                    dayCategorySkipCount++
                    return@forEach
                }
                val local = dayCategoryDao.getById(dto.id)
                if (local == null || dto.updated_at > local.updatedAt) {
                    dayCategoryDao.upsert(dto.toEntity())
                    dayCategoryPullCount++
                }
            }
            if (dayCategorySkipCount > 0) {
                addLog("⚠️ 일별 카테고리 ${dayCategorySkipCount}개 건너뜀 (카테고리 없음)")
            }
            addLog("✓ 일별 카테고리 ${remoteDayCategories.size}개 확인, ${dayCategoryPullCount}개 업데이트")
            updateTableStatus("day_categories", TableSyncStatus.COMPLETED, pulledCount = dayCategoryPullCount)
        } else {
            updateTableStatus("day_categories", TableSyncStatus.COMPLETED)
        }
      } // end db.withTransaction
    }

    /**
     * Push: 로컬 → 원격 (선택된 테이블만, 비교 후 newer만 업로드)
     * // TODO: 로컬에서 하드 삭제된 레코드는 서버에서 정리되지 않음.
     * // pending_remote_deletions 테이블 도입 시 구현 예정.
     */
    private suspend fun syncPush(options: UploadOptions = UploadOptions()) {
        addLog("로컬 데이터 업로드 중...")

        // ── 카테고리 ──
        if (options.categories) {
            updateTableStatus("categories", TableSyncStatus.PUSHING)
            val remoteCategories = try {
                supabaseDataSource.getCategories()
            } catch (e: Exception) {
                addLog("❌ 원격 카테고리 조회 실패: ${e.message}")
                updateTableStatus("categories", TableSyncStatus.ERROR, errorMessage = e.message)
                null
            }
            if (remoteCategories != null) {
                val remoteCategoryMap = remoteCategories.associateBy { it.id }
                var categoryPushCount = 0
                var categoryPushError: String? = null
                categoryDao.getAllOnce().forEach { local ->
                    val remote = remoteCategoryMap[local.id]
                    if (remote == null || local.updatedAt > remote.updated_at) {
                        try {
                            supabaseDataSource.upsertCategory(local)
                            categoryPushCount++
                            addLog("↑ 카테고리 업로드: ${local.name}")
                        } catch (e: Exception) {
                            addLog("❌ 카테고리 업로드 실패 (${local.name}): ${e.message}")
                            categoryPushError = e.message
                        }
                    }
                }
                updateTableStatus("categories", if (categoryPushError != null) TableSyncStatus.ERROR else TableSyncStatus.COMPLETED,
                    pushedCount = categoryPushCount, errorMessage = categoryPushError)
            }

            // 필터 규칙 (카테고리와 그룹)
            updateTableStatus("filter_rules", TableSyncStatus.PUSHING)
            val remoteFilterRules = try {
                supabaseDataSource.getFilterRules()
            } catch (e: Exception) {
                addLog("❌ 원격 필터 규칙 조회 실패: ${e.message}")
                updateTableStatus("filter_rules", TableSyncStatus.ERROR, errorMessage = e.message)
                null
            }
            if (remoteFilterRules != null) {
                val remoteRuleMap = remoteFilterRules.associateBy { it.id }
                var rulePushCount = 0
                var rulePushError: String? = null
                filterRuleDao.getAllOnce().forEach { local ->
                    val remote = remoteRuleMap[local.id]
                    if (remote == null || local.updatedAt > remote.updated_at) {
                        try {
                            supabaseDataSource.upsertFilterRule(local)
                            rulePushCount++
                            addLog("↑ 필터 규칙 업로드")
                        } catch (e: Exception) {
                            addLog("❌ 필터 규칙 업로드 실패: ${e.message}")
                            rulePushError = e.message
                        }
                    }
                }
                updateTableStatus("filter_rules", if (rulePushError != null) TableSyncStatus.ERROR else TableSyncStatus.COMPLETED,
                    pushedCount = rulePushCount, errorMessage = rulePushError)
            }
        } else {
            updateTableStatus("categories", TableSyncStatus.COMPLETED)
            updateTableStatus("filter_rules", TableSyncStatus.COMPLETED)
        }

        // ── 상태 단계 ──
        if (options.statusSteps) {
            updateTableStatus("status_steps", TableSyncStatus.PUSHING)
            val remoteStatusSteps = try {
                supabaseDataSource.getStatusSteps()
            } catch (e: Exception) {
                addLog("❌ 원격 상태 단계 조회 실패: ${e.message}")
                updateTableStatus("status_steps", TableSyncStatus.ERROR, errorMessage = e.message)
                null
            }
            if (remoteStatusSteps != null) {
                val remoteStepMap = remoteStatusSteps.associateBy { it.id }
                var stepPushCount = 0
                var stepPushError: String? = null
                statusStepDao.getAllOnce().forEach { local ->
                    val remote = remoteStepMap[local.id]
                    if (remote == null || local.updatedAt > remote.updated_at) {
                        try {
                            supabaseDataSource.upsertStatusStep(local)
                            stepPushCount++
                            addLog("↑ 상태 단계 업로드: ${local.name}")
                        } catch (e: Exception) {
                            addLog("❌ 상태 단계 업로드 실패 (${local.name}): ${e.message}")
                            stepPushError = e.message
                        }
                    }
                }
                updateTableStatus("status_steps", if (stepPushError != null) TableSyncStatus.ERROR else TableSyncStatus.COMPLETED,
                    pushedCount = stepPushCount, errorMessage = stepPushError)
            }
        } else {
            updateTableStatus("status_steps", TableSyncStatus.COMPLETED)
        }

        // ── 메시지 ──
        if (options.messages) {
            updateTableStatus("captured_messages", TableSyncStatus.PUSHING)
            val remoteMessages = try {
                supabaseDataSource.getMessages()
            } catch (e: Exception) {
                addLog("❌ 원격 메시지 조회 실패: ${e.message}")
                updateTableStatus("captured_messages", TableSyncStatus.ERROR, errorMessage = e.message)
                null
            }
            if (remoteMessages != null) {
                val remoteMessageMap = remoteMessages.associateBy { it.id }
                var messagePushCount = 0
                var messagePushError: String? = null
                val deviceId = getMyDeviceId()
                capturedMessageDao.getAllActiveOnce().forEach { local ->
                    val remote = remoteMessageMap[local.id]
                    if (remote == null || local.updatedAt > remote.updated_at) {
                        try {
                            supabaseDataSource.upsertMessage(local, deviceId)
                            messagePushCount++
                        } catch (e: Exception) {
                            addLog("❌ 메시지 업로드 실패: ${e.message}")
                            messagePushError = e.message
                        }
                    }
                }
                if (messagePushCount > 0) addLog("↑ 메시지 ${messagePushCount}개 업로드")
                updateTableStatus("captured_messages", if (messagePushError != null) TableSyncStatus.ERROR else TableSyncStatus.COMPLETED,
                    pushedCount = messagePushCount, errorMessage = messagePushError)
            }
        } else {
            updateTableStatus("captured_messages", TableSyncStatus.COMPLETED)
        }

        // ── 앱 필터 ──
        if (options.appFilters) {
            updateTableStatus("app_filters", TableSyncStatus.PUSHING)
            val remoteAppFilters = try {
                supabaseDataSource.getAppFilters()
            } catch (e: Exception) {
                addLog("❌ 원격 앱 필터 조회 실패: ${e.message}")
                updateTableStatus("app_filters", TableSyncStatus.ERROR, errorMessage = e.message)
                null
            }
            if (remoteAppFilters != null) {
                val remoteAppFilterMap = remoteAppFilters.associateBy { it.package_name }
                var appFilterPushCount = 0
                var appFilterPushError: String? = null
                appFilterDao.getAllOnce().forEach { local ->
                    val remote = remoteAppFilterMap[local.packageName]
                    if (remote == null || local.updatedAt > remote.updated_at) {
                        try {
                            supabaseDataSource.upsertAppFilter(local)
                            appFilterPushCount++
                            addLog("↑ 앱 필터 업로드: ${local.appName}")
                        } catch (e: Exception) {
                            addLog("❌ 앱 필터 업로드 실패 (${local.appName}): ${e.message}")
                            appFilterPushError = e.message
                        }
                    }
                }
                updateTableStatus("app_filters", if (appFilterPushError != null) TableSyncStatus.ERROR else TableSyncStatus.COMPLETED,
                    pushedCount = appFilterPushCount, errorMessage = appFilterPushError)
            }
        } else {
            updateTableStatus("app_filters", TableSyncStatus.COMPLETED)
        }

        // ── 플랜 ──
        if (options.plans) {
            updateTableStatus("plans", TableSyncStatus.PUSHING)
            val remotePlans = try {
                supabaseDataSource.getPlans()
            } catch (e: Exception) {
                addLog("❌ 원격 플랜 조회 실패: ${e.message}")
                updateTableStatus("plans", TableSyncStatus.ERROR, errorMessage = e.message)
                null
            }
            if (remotePlans != null) {
                val remotePlanMap = remotePlans.associateBy { it.id }
                var planPushCount = 0
                var planPushError: String? = null
                planDao.getAllOnce().forEach { local ->
                    val remote = remotePlanMap[local.id]
                    if (remote == null || local.updatedAt > remote.updated_at) {
                        try {
                            supabaseDataSource.upsertPlan(local)
                            planPushCount++
                        } catch (e: Exception) {
                            addLog("❌ 플랜 업로드 실패: ${e.message}")
                            planPushError = e.message
                        }
                    }
                }
                if (planPushCount > 0) addLog("↑ 플랜 ${planPushCount}개 업로드")
                updateTableStatus("plans", if (planPushError != null) TableSyncStatus.ERROR else TableSyncStatus.COMPLETED,
                    pushedCount = planPushCount, errorMessage = planPushError)
            }
        } else {
            updateTableStatus("plans", TableSyncStatus.COMPLETED)
        }

        // ── 일별 카테고리 ──
        if (options.dayCategories) {
            updateTableStatus("day_categories", TableSyncStatus.PUSHING)
            val remoteDayCategories = try {
                supabaseDataSource.getDayCategories()
            } catch (e: Exception) {
                addLog("❌ 원격 일별 카테고리 조회 실패: ${e.message}")
                updateTableStatus("day_categories", TableSyncStatus.ERROR, errorMessage = e.message)
                null
            }
            if (remoteDayCategories != null) {
                val remoteDayCategoryMap = remoteDayCategories.associateBy { it.id }
                var dayCategoryPushCount = 0
                var dayCategoryPushError: String? = null
                dayCategoryDao.getAllOnce().forEach { local ->
                    val remote = remoteDayCategoryMap[local.id]
                    if (remote == null || local.updatedAt > remote.updated_at) {
                        try {
                            supabaseDataSource.upsertDayCategory(local)
                            dayCategoryPushCount++
                        } catch (e: Exception) {
                            addLog("❌ 일별 카테고리 업로드 실패: ${e.message}")
                            dayCategoryPushError = e.message
                        }
                    }
                }
                if (dayCategoryPushCount > 0) addLog("↑ 일별 카테고리 ${dayCategoryPushCount}개 업로드")
                updateTableStatus("day_categories", if (dayCategoryPushError != null) TableSyncStatus.ERROR else TableSyncStatus.COMPLETED,
                    pushedCount = dayCategoryPushCount, errorMessage = dayCategoryPushError)
            }
        } else {
            updateTableStatus("day_categories", TableSyncStatus.COMPLETED)
        }
    }

    private suspend fun subscribeToRealtimeChanges(userId: String) {
        if (!channelSubscribed.compareAndSet(false, true)) return

        for (attempt in 1..3) {
            try {
                // 이전 채널 정리
                try { realtime.removeAllChannels() } catch (_: Exception) {}

                val channel = realtime.channel("db-changes")

                // Messages changes
                channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = SupabaseDataSource.MESSAGES_TABLE
                }.onEach { action ->
                    handleMessageChange(action, userId)
                }.launchIn(scope)

                // Categories changes
                channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = SupabaseDataSource.CATEGORIES_TABLE
                }.onEach { action ->
                    handleCategoryChange(action, userId)
                }.launchIn(scope)

                // Status steps changes
                channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = SupabaseDataSource.STATUS_STEPS_TABLE
                }.onEach { action ->
                    handleStatusStepChange(action, userId)
                }.launchIn(scope)

                // Filter rules changes
                channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = SupabaseDataSource.FILTER_RULES_TABLE
                }.onEach { action ->
                    handleFilterRuleChange(action, userId)
                }.launchIn(scope)

                // App filters changes
                channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = SupabaseDataSource.APP_FILTERS_TABLE
                }.onEach { action ->
                    handleAppFilterChange(action, userId)
                }.launchIn(scope)

                // Plans changes
                channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = SupabaseDataSource.PLANS_TABLE
                }.onEach { action ->
                    handlePlanChange(action, userId)
                }.launchIn(scope)

                // Day categories changes
                channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = SupabaseDataSource.DAY_CATEGORIES_TABLE
                }.onEach { action ->
                    handleDayCategoryChange(action, userId)
                }.launchIn(scope)

                // Mobile devices changes (sync trigger from web dashboard)
                channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = SupabaseDataSource.MOBILE_DEVICES_TABLE
                }.onEach { action ->
                    handleMobileDeviceChange(action, userId)
                }.launchIn(scope)

                channel.subscribe()
                Log.d(TAG, "Subscribed to realtime changes")
                return
            } catch (e: Exception) {
                Log.e(TAG, "Realtime subscription attempt $attempt/3 failed: ${e.message}", e)
                if (attempt < 3) {
                    kotlinx.coroutines.delay(attempt * 3000L)
                } else {
                    channelSubscribed.set(false)
                    addLog("⚠️ 실시간 연결 실패 (다음 동기화 시 재시도)")
                }
            }
        }
    }

    /**
     * 동기화 리스너 중지 (로그아웃 시 호출)
     */
    fun stopListening() {
        isListening = false
        channelSubscribed.set(false)
        scope.launch {
            try {
                realtime.removeAllChannels()
                Log.d(TAG, "All realtime channels removed")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing channels: ${e.message}", e)
            }
        }
        Log.d(TAG, "Stopped Supabase realtime listeners")
    }

    // ========== Sync methods (local -> remote) ==========

    private fun isUserLoggedIn(): Boolean = auth.currentUserOrNull() != null

    /**
     * 세션이 디스크에서 로딩 완료될 때까지 최대 15초 대기 후 로그인 여부 반환.
     * Auth 플러그인은 앱 프로세스 시작 시 세션을 비동기로 복원하므로,
     * 복원 완료 전에 currentUserOrNull()을 호출하면 false negative가 발생한다.
     * 15초: 디스크 읽기 + JWT 토큰 갱신 네트워크 왕복 시간 고려.
     */
    private suspend fun awaitUserLoggedIn(): Boolean {
        if (isUserLoggedIn()) return true
        // 세션이 아직 로딩 중일 수 있으므로 대기 (느린 네트워크 고려하여 30초)
        val status = withTimeoutOrNull(30_000L) {
            auth.sessionStatus.first { it !is SessionStatus.Initializing }
        }
        return when (status) {
            is SessionStatus.Authenticated -> true
            else -> {
                Log.w(TAG, "awaitUserLoggedIn failed: status=$status")
                false
            }
        }
    }

    suspend fun syncMessage(message: CapturedMessageEntity) {
        if (!isCloudMode) return
        capturedMessageDao.markNeedsSync(message.id)

        if (!awaitUserLoggedIn()) {
            Log.w(TAG, "Message sync deferred (not logged in): ${message.id}")
            scheduleSyncRetry()
            return
        }
        try {
            supabaseDataSource.upsertMessage(message, getMyDeviceId())
            capturedMessageDao.markSynced(message.id)
            Log.d(TAG, "Message synced: ${message.id}")
            updateHeartbeatThrottled()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync message (will retry): ${e.message}", e)
            addLog("❌ 메시지 동기화 실패 (재시도 예정): ${e.message}")
            scheduleSyncRetry()
        }
    }

    /**
     * 원격 서버에서 메시지 영구 삭제 요청.
     * @return 성공 여부 (온라인 상태에서 성공적으로 처리됨)
     */
    suspend fun deleteMessagesRemotely(ids: List<String>): Boolean {
        if (!isCloudMode) return false
        if (!awaitUserLoggedIn()) {
            Log.w(TAG, "Remote message deletion deferred (not logged in)")
            return false
        }
        return try {
            supabaseDataSource.deleteMessages(ids)
            Log.d(TAG, "Messages deleted remotely: $ids")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete messages remotely: ${e.message}", e)
            addLog("❌ 원격 메시지 삭제 실패: ${e.message}")
            false
        }
    }

    /**
     * 영구 삭제 대기 중인 메시지들을 서버에서 삭제하고 로컬에서도 제거
     */
    suspend fun syncPendingDeletions() {
        if (!awaitUserLoggedIn()) return
        val pending = capturedMessageDao.getPendingPermanentDeletions()
        if (pending.isEmpty()) return
        
        addLog("영구 삭제 메시지 ${pending.size}개 동기화 중...")
        val ids = pending.map { it.id }
        try {
            supabaseDataSource.deleteMessages(ids)
            capturedMessageDao.permanentDeleteByIds(ids)
            addLog("✓ 영구 삭제 메시지 ${ids.size}개 처리 완료")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync pending deletions: ${e.message}", e)
            addLog("⚠️ 영구 삭제 동기화 실패 (다음 동기화 시 재시도)")
        }
    }

    suspend fun syncCategory(category: CategoryEntity) {
        if (!isCloudMode) return
        if (!awaitUserLoggedIn()) {
            Log.w(TAG, "Category sync deferred (not logged in): ${category.name}")
            scheduleSyncRetry()
            return
        }
        try {
            supabaseDataSource.upsertCategory(category)
            Log.d(TAG, "Category synced: ${category.name}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync category to Supabase: ${e.message}", e)
            addLog("❌ 카테고리 동기화 실패 (${category.name}): ${e.message}")
            scheduleSyncRetry()
        }
    }

    suspend fun syncFilterRule(rule: FilterRuleEntity) {
        if (!isCloudMode) return
        if (!awaitUserLoggedIn()) {
            Log.w(TAG, "Filter rule sync deferred (not logged in): ${rule.id}")
            scheduleSyncRetry()
            return
        }
        try {
            supabaseDataSource.upsertFilterRule(rule)
            Log.d(TAG, "Filter rule synced: ${rule.id}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync filter rule to Supabase: ${e.message}", e)
            addLog("❌ 필터 규칙 동기화 실패: ${e.message}")
            scheduleSyncRetry()
        }
    }

    suspend fun syncStatusStep(step: StatusStepEntity) {
        if (!isCloudMode) return
        if (!awaitUserLoggedIn()) {
            Log.w(TAG, "Status step sync deferred (not logged in): ${step.name}")
            scheduleSyncRetry()
            return
        }
        try {
            supabaseDataSource.upsertStatusStep(step)
            Log.d(TAG, "Status step synced: ${step.name}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync status step to Supabase: ${e.message}", e)
            addLog("❌ 상태 단계 동기화 실패 (${step.name}): ${e.message}")
            scheduleSyncRetry()
        }
    }

    suspend fun syncAppFilter(filter: AppFilterEntity) {
        if (!isCloudMode) return
        if (!awaitUserLoggedIn()) {
            Log.w(TAG, "App filter sync deferred (not logged in): ${filter.appName}")
            scheduleSyncRetry()
            return
        }
        try {
            supabaseDataSource.upsertAppFilter(filter)
            Log.d(TAG, "App filter synced: ${filter.appName}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync app filter to Supabase: ${e.message}", e)
            addLog("❌ 앱 필터 동기화 실패 (${filter.appName}): ${e.message}")
            scheduleSyncRetry()
        }
    }

    suspend fun syncPlan(plan: PlanEntity) {
        if (!isCloudMode) return
        if (!awaitUserLoggedIn()) {
            Log.w(TAG, "Plan sync deferred (not logged in): ${plan.id}")
            scheduleSyncRetry()
            return
        }
        try {
            supabaseDataSource.upsertPlan(plan)
            Log.d(TAG, "Plan synced: ${plan.id}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync plan to Supabase: ${e.message}", e)
            addLog("❌ 플랜 동기화 실패: ${e.message}")
            scheduleSyncRetry()
        }
    }

    suspend fun syncDayCategory(entity: DayCategoryEntity) {
        if (!isCloudMode) return
        if (!awaitUserLoggedIn()) {
            Log.w(TAG, "DayCategory sync deferred (not logged in): ${entity.id}")
            scheduleSyncRetry()
            return
        }
        try {
            supabaseDataSource.upsertDayCategory(entity)
            Log.d(TAG, "DayCategory synced: ${entity.id}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync day category to Supabase: ${e.message}", e)
            addLog("❌ 일별 카테고리 동기화 실패: ${e.message}")
            scheduleSyncRetry()
        }
    }

    suspend fun deleteDayCategory(id: String) {
        if (!isCloudMode) return
        if (!awaitUserLoggedIn()) {
            Log.w(TAG, "DayCategory delete deferred (not logged in): $id")
            scheduleSyncRetry()
            return
        }
        try {
            supabaseDataSource.deleteDayCategory(id)
            Log.d(TAG, "DayCategory deleted from Supabase: $id")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete day category from Supabase: ${e.message}", e)
            addLog("❌ 일별 카테고리 삭제 동기화 실패: ${e.message}")
            scheduleSyncRetry()
        }
    }

    /**
     * 동기화 보류 중인 메시지 재시도
     */
    internal suspend fun syncPendingMessages() {
        if (!isUserLoggedIn()) return
        val pending = capturedMessageDao.getPendingSync()
        if (pending.isEmpty()) return
        addLog("보류 메시지 ${pending.size}개 동기화 중...")
        var successCount = 0
        val deviceId = getMyDeviceId()
        for (msg in pending) {
            try {
                supabaseDataSource.upsertMessage(msg, deviceId)
                capturedMessageDao.markSynced(msg.id)
                successCount++
            } catch (e: Exception) {
                Log.e(TAG, "Pending sync retry failed for ${msg.id}: ${e.message}", e)
            }
        }
        if (successCount > 0) {
            addLog("✓ 보류 메시지 ${successCount}/${pending.size}개 동기화 완료")
        }
        if (successCount < pending.size) {
            addLog("⚠️ 보류 메시지 ${pending.size - successCount}개 동기화 실패 (다음 동기화 시 재시도)")
        }
    }

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
            ExistingWorkPolicy.REPLACE,
            request
        )
        Log.d(TAG, "Sync retry worker scheduled")
    }

    /**
     * 주기적 동기화 워커 등록 (15분 간격).
     * needsSync=true 메시지를 주기적으로 sweep하여 동기화 누락을 방지한다.
     */
    fun schedulePeriodicSync() {
        if (!isCloudMode) return
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<SyncRetryWorker>(
            15, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .build()

        workManager.enqueueUniquePeriodicWork(
            "periodic_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
        Log.d(TAG, "Periodic sync worker scheduled (every 15 min)")
    }

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

    // ========== Handle realtime changes (remote -> local) ==========

    private suspend fun handleMessageChange(action: PostgresAction, currentUserId: String) {
        try {
            when (action) {
                is PostgresAction.Insert -> {
                    val dto = json.decodeFromJsonElement<MessageDto>(action.record)
                    if (dto.user_id != currentUserId) return // Filter by user
                    val local = capturedMessageDao.getById(dto.id)
                    if (local == null || dto.updated_at > local.updatedAt) {
                        val entity = validateAndCreateMessageEntity(dto)
                        capturedMessageDao.upsert(entity)
                        Log.d(TAG, "Message inserted from realtime: ${dto.id}")
                    }
                }
                is PostgresAction.Update -> {
                    val dto = json.decodeFromJsonElement<MessageDto>(action.record)
                    if (dto.user_id != currentUserId) return // Filter by user
                    val local = capturedMessageDao.getById(dto.id)
                    if (local == null || dto.updated_at > local.updatedAt) {
                        val entity = validateAndCreateMessageEntity(dto)
                        capturedMessageDao.upsert(entity)
                        Log.d(TAG, "Message updated from realtime: ${dto.id}")
                    }
                }
                is PostgresAction.Delete -> {
                    val oldRecord = action.oldRecord
                    val id = oldRecord["id"]?.toString()?.removeSurrounding("\"")
                    if (id != null) {
                        capturedMessageDao.deleteById(id)
                        Log.d(TAG, "Message deleted from realtime: $id")
                    }
                }
                else -> {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling message change", e)
        }
    }

    /**
     * Validates foreign keys and creates a message entity with null values for non-existent references
     */
    private suspend fun validateAndCreateMessageEntity(dto: MessageDto): CapturedMessageEntity {
        val validCategoryId = dto.category_id?.let { id ->
            categoryDao.getById(id)?.id
        }
        val validStatusId = dto.status_id?.let { id ->
            statusStepDao.getById(id)?.id
        }
        val validRuleId = dto.matched_rule_id?.let { id ->
            filterRuleDao.getById(id)?.id
        }
        return dto.toEntity().copy(
            categoryId = validCategoryId,
            statusId = validStatusId,
            matchedRuleId = validRuleId,
            needsSync = false
        )
    }

    private suspend fun handleCategoryChange(action: PostgresAction, currentUserId: String) {
        try {
            when (action) {
                is PostgresAction.Insert, is PostgresAction.Update -> {
                    val record = when (action) {
                        is PostgresAction.Insert -> action.record
                        is PostgresAction.Update -> action.record
                        else -> return
                    }
                    val dto = json.decodeFromJsonElement<CategoryDto>(record)
                    if (dto.user_id != currentUserId) return // Filter by user
                    val local = categoryDao.getById(dto.id)
                    if (local == null || dto.updated_at > local.updatedAt) {
                        categoryDao.upsert(dto.toEntity())
                        Log.d(TAG, "Category synced from realtime: ${dto.id}")
                    }
                }
                is PostgresAction.Delete -> {
                    val id = action.oldRecord["id"]?.toString()?.removeSurrounding("\"")
                    if (id != null) {
                        categoryDao.softDelete(id)
                        Log.d(TAG, "Category deleted from realtime: $id")
                    }
                }
                else -> {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling category change", e)
        }
    }

    private suspend fun handleStatusStepChange(action: PostgresAction, currentUserId: String) {
        try {
            when (action) {
                is PostgresAction.Insert, is PostgresAction.Update -> {
                    val record = when (action) {
                        is PostgresAction.Insert -> action.record
                        is PostgresAction.Update -> action.record
                        else -> return
                    }
                    val dto = json.decodeFromJsonElement<StatusStepDto>(record)
                    if (dto.user_id != currentUserId) return // Filter by user
                    val local = statusStepDao.getById(dto.id)
                    if (local == null || dto.updated_at > local.updatedAt) {
                        statusStepDao.upsert(dto.toEntity())
                        Log.d(TAG, "StatusStep synced from realtime: ${dto.id}")
                    }
                }
                is PostgresAction.Delete -> {
                    val id = action.oldRecord["id"]?.toString()?.removeSurrounding("\"")
                    if (id != null) {
                        statusStepDao.softDelete(id)
                        Log.d(TAG, "StatusStep deleted from realtime: $id")
                    }
                }
                else -> {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling status step change", e)
        }
    }

    private suspend fun handleFilterRuleChange(action: PostgresAction, currentUserId: String) {
        try {
            when (action) {
                is PostgresAction.Insert, is PostgresAction.Update -> {
                    val record = when (action) {
                        is PostgresAction.Insert -> action.record
                        is PostgresAction.Update -> action.record
                        else -> return
                    }
                    val dto = json.decodeFromJsonElement<FilterRuleDto>(record)
                    if (dto.user_id != currentUserId) return // Filter by user
                    // Validate category exists locally (FK constraint)
                    val categoryExists = categoryDao.getById(dto.category_id) != null
                    if (!categoryExists) {
                        Log.w(TAG, "Skipping filter rule ${dto.id}: category ${dto.category_id} not found locally")
                        return
                    }
                    val local = filterRuleDao.getById(dto.id)
                    if (local == null || dto.updated_at > local.updatedAt) {
                        filterRuleDao.upsert(dto.toEntity())
                        Log.d(TAG, "FilterRule synced from realtime: ${dto.id}")
                    }
                }
                is PostgresAction.Delete -> {
                    val id = action.oldRecord["id"]?.toString()?.removeSurrounding("\"")
                    if (id != null) {
                        filterRuleDao.softDelete(id)
                        Log.d(TAG, "FilterRule deleted from realtime: $id")
                    }
                }
                else -> {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling filter rule change", e)
        }
    }

    private suspend fun handleAppFilterChange(action: PostgresAction, currentUserId: String) {
        try {
            when (action) {
                is PostgresAction.Insert, is PostgresAction.Update -> {
                    val record = when (action) {
                        is PostgresAction.Insert -> action.record
                        is PostgresAction.Update -> action.record
                        else -> return
                    }
                    val dto = json.decodeFromJsonElement<AppFilterDto>(record)
                    if (dto.user_id != currentUserId) return // Filter by user
                    val local = appFilterDao.getByPackageName(dto.package_name)
                    if (local == null || dto.updated_at > local.updatedAt) {
                        appFilterDao.upsert(dto.toEntity())
                        Log.d(TAG, "AppFilter synced from realtime: ${dto.package_name}")
                    }
                }
                is PostgresAction.Delete -> {
                    val packageName = action.oldRecord["package_name"]?.toString()?.removeSurrounding("\"")
                    if (packageName != null) {
                        appFilterDao.softDelete(packageName)
                        Log.d(TAG, "AppFilter deleted from realtime: $packageName")
                    }
                }
                else -> {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling app filter change", e)
        }
    }

    private suspend fun handlePlanChange(action: PostgresAction, currentUserId: String) {
        try {
            when (action) {
                is PostgresAction.Insert, is PostgresAction.Update -> {
                    val record = when (action) {
                        is PostgresAction.Insert -> action.record
                        is PostgresAction.Update -> action.record
                        else -> return
                    }
                    val dto = json.decodeFromJsonElement<PlanDto>(record)
                    if (dto.user_id != currentUserId) return
                    val local = planDao.getById(dto.id)
                    if (local == null || dto.updated_at > local.updatedAt) {
                        val validCategoryId = dto.category_id?.let { id ->
                            categoryDao.getById(id)?.id
                        }
                        planDao.upsert(dto.toEntity().copy(categoryId = validCategoryId))
                        Log.d(TAG, "Plan synced from realtime: ${dto.id}")
                    }
                }
                is PostgresAction.Delete -> {
                    val id = action.oldRecord["id"]?.toString()?.removeSurrounding("\"")
                    if (id != null) {
                        planDao.softDelete(id)
                        Log.d(TAG, "Plan deleted from realtime: $id")
                    }
                }
                else -> {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling plan change", e)
        }
    }

    private suspend fun handleDayCategoryChange(action: PostgresAction, currentUserId: String) {
        try {
            when (action) {
                is PostgresAction.Insert, is PostgresAction.Update -> {
                    val record = when (action) {
                        is PostgresAction.Insert -> action.record
                        is PostgresAction.Update -> action.record
                        else -> return
                    }
                    val dto = json.decodeFromJsonElement<DayCategoryDto>(record)
                    if (dto.user_id != currentUserId) return
                    // Validate category exists locally (FK constraint)
                    val categoryExists = categoryDao.getById(dto.category_id) != null
                    if (!categoryExists) {
                        Log.w(TAG, "Skipping day category ${dto.id}: category ${dto.category_id} not found locally")
                        return
                    }
                    val local = dayCategoryDao.getById(dto.id)
                    if (local == null || dto.updated_at > local.updatedAt) {
                        dayCategoryDao.upsert(dto.toEntity())
                        Log.d(TAG, "DayCategory synced from realtime: ${dto.id}")
                    }
                }
                is PostgresAction.Delete -> {
                    val id = action.oldRecord["id"]?.toString()?.removeSurrounding("\"")
                    if (id != null) {
                        dayCategoryDao.deleteById(id)
                        Log.d(TAG, "DayCategory deleted from realtime: $id")
                    }
                }
                else -> {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling day category change", e)
        }
    }

    @Suppress("HardwareIds")
    private suspend fun handleMobileDeviceChange(action: PostgresAction, currentUserId: String) {
        try {
            when (action) {
                is PostgresAction.Update -> {
                    // 동기화 중이면 무시 (무한 루프 방지)
                    if (_syncStatus.value == SyncStatus.SYNCING) return

                    val dto = json.decodeFromJsonElement<MobileDeviceDto>(action.record)
                    if (dto.user_id != currentUserId) return
                    val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                    val myDeviceId = "${currentUserId}_${androidId}"
                    if (dto.id != myDeviceId) return

                    if (dto.sync_requested_at != null) {
                        Log.d(TAG, "Remote sync request received from web dashboard (Realtime)")
                        addLog("🔄 웹 대시보드에서 동기화 요청 수신")
                        // sync_requested_at을 클리어하여 재트리거 방지
                        forceSync(clearRequest = true)
                    }
                }
                else -> {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling mobile device change", e)
        }
    }
}
