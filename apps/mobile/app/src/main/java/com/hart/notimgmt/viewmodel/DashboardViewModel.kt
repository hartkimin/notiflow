package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.preferences.AppPreferences.Companion.UNCATEGORIZED_ID
import com.hart.notimgmt.data.repository.CategoryRepository
import com.hart.notimgmt.data.repository.MessageRepository
import com.hart.notimgmt.data.repository.StatusStepRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.Calendar
import javax.inject.Inject

enum class UrgencyLevel { URGENT, WARNING, NORMAL }

data class CategorySummary(
    val categoryId: String?,
    val name: String,
    val color: Int,
    val pendingCount: Int,
    val urgentCount: Int
)

data class ChatRoomItem(
    val source: String,
    val appName: String,
    val sender: String,
    val lastMessage: String,
    val lastReceivedAt: Long,
    val unreadCount: Int,
    val senderIcon: String?
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    private val categoryRepository: CategoryRepository,
    private val statusStepRepository: StatusStepRepository,
    private val appPreferences: AppPreferences
) : ViewModel() {

    val categories: StateFlow<List<CategoryEntity>> = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val statusSteps: StateFlow<List<StatusStepEntity>> = statusStepRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 숨김 카테고리
    private val hiddenCategoryIds = appPreferences.hiddenCategoryIdsFlow

    private fun List<CapturedMessageEntity>.filterHidden(hidden: Set<String>): List<CapturedMessageEntity> {
        if (hidden.isEmpty()) return this
        return filter { msg ->
            val catId = msg.categoryId ?: UNCATEGORIZED_ID
            !hidden.contains(catId)
        }
    }

    // Chat Rooms Flow
    val chatRooms: StateFlow<List<ChatRoomItem>> = combine(
        messageRepository.getAllActiveFlow(),
        statusSteps
    ) { messages, steps ->
        val firstStepId = steps.firstOrNull()?.id
        
        val grouped = messages.groupBy { Pair(it.source, it.sender) }
        grouped.map { (key, roomMessages) ->
            val (source, sender) = key
            val lastMsg = roomMessages.first()
            val unreadCount = if (firstStepId != null) {
                roomMessages.count { it.statusId == firstStepId }
            } else 0

            ChatRoomItem(
                source = source,
                appName = lastMsg.appName,
                sender = sender,
                lastMessage = lastMsg.content,
                lastReceivedAt = lastMsg.receivedAt,
                unreadCount = unreadCount,
                senderIcon = lastMsg.senderIcon
            )
        }.sortedByDescending { it.lastReceivedAt }
    }
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 통계
    private val todayStart: Long
        get() = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

    private val yesterdayStart: Long
        get() = todayStart - 24 * 60 * 60 * 1000

    // 24시간 전 (긴급 기준)
    private val urgentThreshold: Long
        get() = System.currentTimeMillis() - 24 * 60 * 60 * 1000

    val todayCount: StateFlow<Int> = messageRepository.getCountSince(todayStart)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    // 전일 대비 증감
    val todayDelta: StateFlow<Int> = combine(
        messageRepository.getCountSince(todayStart),
        messageRepository.getCountBetween(yesterdayStart, todayStart)
    ) { today, yesterday -> today - yesterday }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val pendingCount: StateFlow<Int> = statusSteps
        .flatMapLatest { steps ->
            val firstStep = steps.firstOrNull()
            if (firstStep != null) messageRepository.getCountByStatus(firstStep.id)
            else flowOf(0)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    // 긴급 메시지 수 (24시간+)
    val urgentCount: StateFlow<Int> = combine(
        statusSteps, hiddenCategoryIds
    ) { steps, hidden -> Pair(steps, hidden) }
        .flatMapLatest { (steps, _) ->
            val firstStep = steps.firstOrNull()
            if (firstStep != null) {
                messageRepository.getAll().map { messages ->
                    messages.count { msg ->
                        msg.statusId == firstStep.id &&
                        (System.currentTimeMillis() - msg.receivedAt) >= 24 * 60 * 60 * 1000
                    }
                }
            } else flowOf(0)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val completedCount: StateFlow<Int> = statusSteps
        .flatMapLatest { steps ->
            val lastStep = steps.lastOrNull()
            if (lastStep != null) messageRepository.getCountByStatus(lastStep.id)
            else flowOf(0)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    // 오늘 완료 건수
    val completedTodayCount: StateFlow<Int> = statusSteps
        .flatMapLatest { steps ->
            val lastStep = steps.lastOrNull()
            if (lastStep != null) messageRepository.getCompletedTodayCount(lastStep.id, todayStart)
            else flowOf(0)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    // 처리율 (완료 / (완료 + 미처리) * 100)
    val completionRate: StateFlow<Int> = combine(
        completedTodayCount, pendingCount
    ) { completed, pending ->
        val total = completed + pending
        if (total > 0) (completed * 100) / total else 0
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _statsExpanded = MutableStateFlow(appPreferences.statsCardExpanded)
    val statsExpanded: StateFlow<Boolean> = _statsExpanded

    fun toggleStatsExpanded() {
        val newValue = !_statsExpanded.value
        _statsExpanded.value = newValue
        appPreferences.statsCardExpanded = newValue
    }

    // 미처리 메시지 (첫 번째 상태, 최대 5개, 숨김 카테고리 제외, 오래된 순서)
    val pendingMessages: StateFlow<List<CapturedMessageEntity>> = combine(
        statusSteps, hiddenCategoryIds
    ) { steps, hidden -> Pair(steps, hidden) }
        .flatMapLatest { (steps, hidden) ->
            val firstStep = steps.firstOrNull()
            if (firstStep != null) {
                messageRepository.getAll().map { messages ->
                    messages.filter { it.statusId == firstStep.id }
                        .filterHidden(hidden)
                        .sortedBy { it.receivedAt } // 오래된 순서 (긴급한 것 먼저)
                        .take(5)
                }
            } else {
                flowOf(emptyList())
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 오늘 완료한 메시지 (최대 5개)
    val completedTodayMessages: StateFlow<List<CapturedMessageEntity>> = statusSteps
        .flatMapLatest { steps ->
            val lastStep = steps.lastOrNull()
            if (lastStep != null) {
                messageRepository.getCompletedToday(lastStep.id, todayStart, 5)
            } else {
                flowOf(emptyList())
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 카테고리별 요약
    val categorySummaries: StateFlow<List<CategorySummary>> = combine(
        statusSteps, categories, hiddenCategoryIds
    ) { steps, cats, hidden -> Triple(steps, cats, hidden) }
        .flatMapLatest { (steps, cats, hidden) ->
            val firstStep = steps.firstOrNull()
            if (firstStep != null) {
                messageRepository.getCategorySummaries(firstStep.id, urgentThreshold).map { summaries ->
                    val categoryMap = cats.associateBy { it.id }
                    summaries
                        .filter { row ->
                            val catId = row.categoryId ?: UNCATEGORIZED_ID
                            !hidden.contains(catId)
                        }
                        .map { row ->
                            val category = row.categoryId?.let { categoryMap[it] }
                            CategorySummary(
                                categoryId = row.categoryId,
                                name = category?.name ?: "미분류",
                                color = category?.color ?: 0xFF9E9E9E.toInt(),
                                pendingCount = row.pendingCount,
                                urgentCount = row.urgentCount
                            )
                        }
                        .sortedByDescending { it.pendingCount }
                }
            } else {
                flowOf(emptyList())
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 최근 메시지 (최신 순, 최대 5개, 숨김 카테고리 제외)
    val recentMessages: StateFlow<List<CapturedMessageEntity>> = combine(
        messageRepository.getAll(), hiddenCategoryIds
    ) { messages, hidden ->
        messages.filterHidden(hidden)
            .sortedByDescending { it.receivedAt }
            .take(5)
    }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 긴급도 계산
    fun calculateUrgency(receivedAt: Long): UrgencyLevel {
        val hours = (System.currentTimeMillis() - receivedAt) / (1000 * 60 * 60)
        return when {
            hours >= 48 -> UrgencyLevel.URGENT
            hours >= 24 -> UrgencyLevel.WARNING
            else -> UrgencyLevel.NORMAL
        }
    }

    // 메시지를 다음 상태로 이동
    fun moveToNextStatus(messageId: String) {
        viewModelScope.launch {
            val message = messageRepository.getById(messageId) ?: return@launch
            val steps = statusSteps.value
            if (steps.isEmpty()) return@launch
            val currentIndex = steps.indexOfFirst { it.id == message.statusId }
            val nextIndex = if (currentIndex < 0) 0 else (currentIndex + 1).coerceAtMost(steps.lastIndex)
            messageRepository.updateStatus(messageId, steps[nextIndex].id)
        }
    }

    // 메시지를 특정 상태로 이동
    fun moveToStatus(messageId: String, statusId: String) {
        viewModelScope.launch {
            messageRepository.updateStatus(messageId, statusId)
        }
    }
}
