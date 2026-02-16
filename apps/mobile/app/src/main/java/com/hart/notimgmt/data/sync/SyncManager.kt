package com.hart.notimgmt.data.sync

import android.util.Log
import com.hart.notimgmt.data.db.dao.*
import com.hart.notimgmt.data.db.entity.*
import com.hart.notimgmt.data.notiflow.NotiFlowApiClient
import com.hart.notimgmt.data.supabase.*
import io.github.jan.supabase.auth.Auth
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
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement
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
    val syncLogs: List<String> = emptyList()
)

@Singleton
class SyncManager @Inject constructor(
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
    private val notiFlowApiClient: NotiFlowApiClient
) {
    companion object {
        private const val TAG = "SyncManager"
        private const val MAX_LOGS = 50
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    private val _syncStatus = MutableStateFlow(SyncStatus.IDLE)
    val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    private val _syncState = MutableStateFlow(SyncState())
    val syncState: StateFlow<SyncState> = _syncState.asStateFlow()

    private var isListening = false
    private var channelSubscribed = false

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
        _syncState.value = SyncState()
    }

    /**
     * 수동 동기화 (강제)
     */
    fun forceSync() {
        val userId = auth.currentUserOrNull()?.id
        if (userId == null) {
            addLog("❌ 로그인이 필요합니다")
            return
        }

        if (_syncStatus.value == SyncStatus.SYNCING) {
            addLog("⚠️ 동기화가 이미 진행 중입니다")
            return
        }

        scope.launch {
            try {
                initialSync()
                if (!channelSubscribed) {
                    subscribeToRealtimeChanges(userId)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Force sync failed", e)
                addLog("❌ 동기화 실패: ${e.message}")
                _syncStatus.value = SyncStatus.ERROR
                _syncState.value = _syncState.value.copy(overallStatus = SyncStatus.ERROR)
            }
        }
    }

    /**
     * 동기화 리스너 시작 (로그인 후 호출)
     */
    fun startListening() {
        val userId = auth.currentUserOrNull()?.id
        if (isListening || userId == null) {
            Log.d(TAG, "Skipping startListening: isListening=$isListening, userId=$userId")
            return
        }

        isListening = true
        Log.d(TAG, "Starting Supabase realtime listeners for user: $userId")

        scope.launch {
            try {
                // Initial sync - fetch all data from Supabase
                initialSync()

                // Subscribe to realtime changes
                subscribeToRealtimeChanges(userId)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start listening", e)
                _syncStatus.value = SyncStatus.ERROR
            }
        }
    }

    private suspend fun initialSync() {
        _syncStatus.value = SyncStatus.SYNCING
        _syncState.value = _syncState.value.copy(overallStatus = SyncStatus.SYNCING)
        resetTableStatuses()
        addLog("동기화 시작...")

        try {
            // ========== Pull from Supabase (remote -> local) ==========

            // Sync categories from remote
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

            // Sync status steps from remote
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

            // Sync filter rules from remote
            addLog("필터 규칙 가져오는 중...")
            updateTableStatus("filter_rules", TableSyncStatus.PULLING)
            val remoteFilterRules = try {
                supabaseDataSource.getFilterRules()
            } catch (e: Exception) {
                addLog("❌ 필터 규칙 가져오기 실패: ${e.message}")
                updateTableStatus("filter_rules", TableSyncStatus.ERROR, errorMessage = e.message)
                emptyList()
            }
            // Get valid category IDs for FK validation
            val validCategoryIdsForRules = categoryDao.getAllOnce().map { it.id }.toSet()
            var rulePullCount = 0
            var ruleSkipCount = 0
            remoteFilterRules.forEach { dto ->
                // Skip if category doesn't exist locally (FK constraint)
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

            // Sync messages from remote
            addLog("메시지 가져오는 중...")
            updateTableStatus("captured_messages", TableSyncStatus.PULLING)
            val remoteMessages = try {
                supabaseDataSource.getMessages()
            } catch (e: Exception) {
                addLog("❌ 메시지 가져오기 실패: ${e.message}")
                updateTableStatus("captured_messages", TableSyncStatus.ERROR, errorMessage = e.message)
                emptyList()
            }
            // Collect valid foreign key IDs to avoid FK constraint errors
            val validCategoryIds = categoryDao.getAllOnce().map { it.id }.toSet()
            val validStatusIds = statusStepDao.getAllOnce().map { it.id }.toSet()
            val validRuleIds = filterRuleDao.getAllOnce().map { it.id }.toSet()

            var messagePullCount = 0
            remoteMessages.forEach { dto ->
                val local = capturedMessageDao.getById(dto.id)
                if (local == null || dto.updated_at > local.updatedAt) {
                    // Validate foreign keys - set to null if referenced entity doesn't exist
                    val entity = dto.toEntity().copy(
                        categoryId = if (dto.category_id in validCategoryIds) dto.category_id else null,
                        statusId = if (dto.status_id in validStatusIds) dto.status_id else null,
                        matchedRuleId = if (dto.matched_rule_id in validRuleIds) dto.matched_rule_id else null
                    )
                    capturedMessageDao.upsert(entity)
                    messagePullCount++
                }
            }
            addLog("✓ 메시지 ${remoteMessages.size}개 확인, ${messagePullCount}개 업데이트")

            // Sync app filters from remote
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

            // ========== Push to Supabase (local -> remote) ==========
            addLog("로컬 데이터 업로드 중...")

            // Push local categories that don't exist in remote
            updateTableStatus("categories", TableSyncStatus.PUSHING, pulledCount = categoryPullCount)
            val remoteCategoryIds = remoteCategories.map { it.id }.toSet()
            var categoryPushCount = 0
            var categoryPushError: String? = null
            categoryDao.getAllOnce().forEach { local ->
                if (local.id !in remoteCategoryIds) {
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
                pulledCount = categoryPullCount, pushedCount = categoryPushCount, errorMessage = categoryPushError)

            // Push local status steps that don't exist in remote
            updateTableStatus("status_steps", TableSyncStatus.PUSHING, pulledCount = stepPullCount)
            val remoteStepIds = remoteStatusSteps.map { it.id }.toSet()
            var stepPushCount = 0
            var stepPushError: String? = null
            statusStepDao.getAllOnce().forEach { local ->
                if (local.id !in remoteStepIds) {
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
                pulledCount = stepPullCount, pushedCount = stepPushCount, errorMessage = stepPushError)

            // Push local filter rules that don't exist in remote
            updateTableStatus("filter_rules", TableSyncStatus.PUSHING, pulledCount = rulePullCount)
            val remoteRuleIds = remoteFilterRules.map { it.id }.toSet()
            var rulePushCount = 0
            var rulePushError: String? = null
            filterRuleDao.getAllOnce().forEach { local ->
                if (local.id !in remoteRuleIds) {
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
                pulledCount = rulePullCount, pushedCount = rulePushCount, errorMessage = rulePushError)

            // Push local messages that don't exist in remote
            updateTableStatus("captured_messages", TableSyncStatus.PUSHING, pulledCount = messagePullCount)
            val remoteMessageIds = remoteMessages.map { it.id }.toSet()
            var messagePushCount = 0
            var messagePushError: String? = null
            capturedMessageDao.getAllOnce().forEach { local ->
                if (local.id !in remoteMessageIds) {
                    try {
                        supabaseDataSource.upsertMessage(local)
                        messagePushCount++
                    } catch (e: Exception) {
                        addLog("❌ 메시지 업로드 실패: ${e.message}")
                        messagePushError = e.message
                    }
                }
            }
            if (messagePushCount > 0) addLog("↑ 메시지 ${messagePushCount}개 업로드")
            updateTableStatus("captured_messages", if (messagePushError != null) TableSyncStatus.ERROR else TableSyncStatus.COMPLETED,
                pulledCount = messagePullCount, pushedCount = messagePushCount, errorMessage = messagePushError)

            // Push local app filters that don't exist in remote
            updateTableStatus("app_filters", TableSyncStatus.PUSHING, pulledCount = appFilterPullCount)
            val remoteAppFilterPackages = remoteAppFilters.map { it.package_name }.toSet()
            var appFilterPushCount = 0
            var appFilterPushError: String? = null
            appFilterDao.getAllOnce().forEach { local ->
                if (local.packageName !in remoteAppFilterPackages) {
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
                pulledCount = appFilterPullCount, pushedCount = appFilterPushCount, errorMessage = appFilterPushError)

            // Sync plans from remote
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

            // Push local plans that don't exist in remote
            updateTableStatus("plans", TableSyncStatus.PUSHING, pulledCount = planPullCount)
            val remotePlanIds = remotePlans.map { it.id }.toSet()
            var planPushCount = 0
            var planPushError: String? = null
            planDao.getAllOnce().forEach { local ->
                if (local.id !in remotePlanIds) {
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
                pulledCount = planPullCount, pushedCount = planPushCount, errorMessage = planPushError)

            // Sync day categories from remote
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

            // Push local day categories that don't exist in remote
            updateTableStatus("day_categories", TableSyncStatus.PUSHING, pulledCount = dayCategoryPullCount)
            val remoteDayCategoryIds = remoteDayCategories.map { it.id }.toSet()
            var dayCategoryPushCount = 0
            var dayCategoryPushError: String? = null
            dayCategoryDao.getAllOnce().forEach { local ->
                if (local.id !in remoteDayCategoryIds) {
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
                pulledCount = dayCategoryPullCount, pushedCount = dayCategoryPushCount, errorMessage = dayCategoryPushError)

            _syncStatus.value = SyncStatus.IDLE
            _syncState.value = _syncState.value.copy(overallStatus = SyncStatus.IDLE)
            addLog("✅ 동기화 완료!")
        } catch (e: Exception) {
            Log.e(TAG, "Initial sync failed: ${e.message}", e)
            addLog("❌ 동기화 실패: ${e.message}")
            _syncStatus.value = SyncStatus.ERROR
            _syncState.value = _syncState.value.copy(overallStatus = SyncStatus.ERROR)
        }
    }

    private suspend fun subscribeToRealtimeChanges(userId: String) {
        if (channelSubscribed) return

        try {
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

            channel.subscribe()
            channelSubscribed = true
            Log.d(TAG, "Subscribed to realtime changes")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to subscribe to realtime changes", e)
        }
    }

    /**
     * 동기화 리스너 중지 (로그아웃 시 호출)
     */
    fun stopListening() {
        isListening = false
        channelSubscribed = false
        scope.launch {
            try {
                realtime.removeAllChannels()
            } catch (e: Exception) {
                Log.e(TAG, "Error removing channels", e)
            }
        }
        Log.d(TAG, "Stopped Supabase realtime listeners")
    }

    // ========== Sync methods (local -> remote) ==========

    private fun isUserLoggedIn(): Boolean = auth.currentUserOrNull() != null

    suspend fun syncMessage(message: CapturedMessageEntity) {
        if (!isUserLoggedIn()) return
        // Supabase 동기화
        try {
            supabaseDataSource.upsertMessage(message)
            Log.d(TAG, "Message synced: ${message.id}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync message to Supabase: ${e.message}", e)
            addLog("❌ 메시지 동기화 실패: ${e.message}")
        }
        // NotiFlow API Gateway 동시 전송 (실패해도 Supabase에 영향 없음)
        try {
            notiFlowApiClient.sendMessage(message)
            Log.d(TAG, "Message sent to NotiFlow: ${message.id}")
        } catch (e: Exception) {
            Log.e(TAG, "NotiFlow 전송 실패: ${e.message}")
        }
    }

    suspend fun syncCategory(category: CategoryEntity) {
        if (!isUserLoggedIn()) return
        try {
            supabaseDataSource.upsertCategory(category)
            Log.d(TAG, "Category synced: ${category.name}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync category to Supabase: ${e.message}", e)
            addLog("❌ 카테고리 동기화 실패 (${category.name}): ${e.message}")
        }
    }

    suspend fun syncFilterRule(rule: FilterRuleEntity) {
        if (!isUserLoggedIn()) return
        try {
            supabaseDataSource.upsertFilterRule(rule)
            Log.d(TAG, "Filter rule synced: ${rule.id}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync filter rule to Supabase: ${e.message}", e)
            addLog("❌ 필터 규칙 동기화 실패: ${e.message}")
        }
    }

    suspend fun syncStatusStep(step: StatusStepEntity) {
        if (!isUserLoggedIn()) return
        try {
            supabaseDataSource.upsertStatusStep(step)
            Log.d(TAG, "Status step synced: ${step.name}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync status step to Supabase: ${e.message}", e)
            addLog("❌ 상태 단계 동기화 실패 (${step.name}): ${e.message}")
        }
    }

    suspend fun syncAppFilter(filter: AppFilterEntity) {
        if (!isUserLoggedIn()) return
        try {
            supabaseDataSource.upsertAppFilter(filter)
            Log.d(TAG, "App filter synced: ${filter.appName}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync app filter to Supabase: ${e.message}", e)
            addLog("❌ 앱 필터 동기화 실패 (${filter.appName}): ${e.message}")
        }
    }

    suspend fun syncPlan(plan: PlanEntity) {
        if (!isUserLoggedIn()) return
        try {
            supabaseDataSource.upsertPlan(plan)
            Log.d(TAG, "Plan synced: ${plan.id}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync plan to Supabase: ${e.message}", e)
            addLog("❌ 플랜 동기화 실패: ${e.message}")
        }
    }

    suspend fun syncDayCategory(entity: DayCategoryEntity) {
        if (!isUserLoggedIn()) return
        try {
            supabaseDataSource.upsertDayCategory(entity)
            Log.d(TAG, "DayCategory synced: ${entity.id}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync day category to Supabase: ${e.message}", e)
            addLog("❌ 일별 카테고리 동기화 실패: ${e.message}")
        }
    }

    suspend fun deleteDayCategory(id: String) {
        if (!isUserLoggedIn()) return
        try {
            supabaseDataSource.deleteDayCategory(id)
            Log.d(TAG, "DayCategory deleted from Supabase: $id")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete day category from Supabase: ${e.message}", e)
            addLog("❌ 일별 카테고리 삭제 동기화 실패: ${e.message}")
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
                        capturedMessageDao.softDelete(id)
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
            matchedRuleId = validRuleId
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
}
