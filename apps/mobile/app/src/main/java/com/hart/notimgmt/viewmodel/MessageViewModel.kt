package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.data.model.SortOrder
import com.hart.notimgmt.data.model.StatusChangeItem
import com.hart.notimgmt.data.model.parseComments
import com.hart.notimgmt.data.model.parseStatusHistory
import com.hart.notimgmt.data.model.serializeComments
import com.hart.notimgmt.data.model.serializeStatusHistory
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.preferences.AppPreferences.Companion.UNCATEGORIZED_ID
import com.hart.notimgmt.data.repository.CategoryRepository
import com.hart.notimgmt.data.repository.MessageRepository
import com.hart.notimgmt.data.repository.StatusStepRepository
import com.hart.notimgmt.service.snooze.SnoozeManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.Calendar
import javax.inject.Inject

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class MessageViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    private val categoryRepository: CategoryRepository,
    private val statusStepRepository: StatusStepRepository,
    private val appPreferences: AppPreferences,
    private val snoozeManager: SnoozeManager
) : ViewModel() {

    val categories = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _filterStatusId = MutableStateFlow<String?>(null)
    val filterStatusId: StateFlow<String?> = _filterStatusId

    private val _filterCompletedToday = MutableStateFlow(false)
    val filterCompletedToday: StateFlow<Boolean> = _filterCompletedToday

    private val _sortOrder = MutableStateFlow(SortOrder.NEWEST)
    val sortOrder: StateFlow<SortOrder> = _sortOrder

    // 숨김 카테고리
    val hiddenCategoryIds: StateFlow<Set<String>> = appPreferences.hiddenCategoryIdsFlow

    // 카테고리 필터 (null = 전체, Set = 선택된 카테고리들)
    private val _selectedCategoryIds = MutableStateFlow<Set<String>?>(null)
    val selectedCategoryIds: StateFlow<Set<String>?> = _selectedCategoryIds

    // 필터 패널 표시 여부
    private val _showCategoryFilter = MutableStateFlow(false)
    val showCategoryFilter: StateFlow<Boolean> = _showCategoryFilter

    fun toggleCategoryFilter() {
        _showCategoryFilter.value = !_showCategoryFilter.value
    }

    fun toggleCategorySelection(categoryId: String) {
        val current = _selectedCategoryIds.value
        if (current == null) {
            _selectedCategoryIds.value = setOf(categoryId)
        } else if (current.contains(categoryId)) {
            val newSet = current - categoryId
            _selectedCategoryIds.value = if (newSet.isEmpty()) null else newSet
        } else {
            _selectedCategoryIds.value = current + categoryId
        }
    }

    fun selectAllCategories() {
        _selectedCategoryIds.value = null
    }

    fun isCategorySelected(categoryId: String): Boolean {
        val selected = _selectedCategoryIds.value
        return selected == null || selected.contains(categoryId)
    }

    // 오늘 시작 시간 (오늘 완료 필터용)
    private val todayStart: Long
        get() = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

    val messages: StateFlow<List<CapturedMessageEntity>> = combine(
        _selectedCategoryIds, _filterStatusId, hiddenCategoryIds, _filterCompletedToday
    ) { _, _, _, _ -> Unit }
        .flatMapLatest {
            messageRepository.getAll()
        }
        // 미분류 메시지 제외 (categoryId가 null인 메시지)
        .map { msgs -> msgs.filter { it.categoryId != null } }
        .combine(hiddenCategoryIds) { msgs, hidden ->
            if (hidden.isNotEmpty()) {
                msgs.filter { msg ->
                    msg.categoryId != null && !hidden.contains(msg.categoryId)
                }
            } else msgs
        }
        .combine(_selectedCategoryIds) { msgs, selected ->
            if (selected != null) {
                msgs.filter { msg ->
                    msg.categoryId != null && selected.contains(msg.categoryId)
                }
            } else msgs
        }
        .combine(_filterStatusId) { msgs, statusId ->
            if (statusId != null) msgs.filter { it.statusId == statusId } else msgs
        }
        .combine(_filterCompletedToday) { msgs, completedToday ->
            if (completedToday) {
                msgs.filter { (it.statusChangedAt ?: it.updatedAt) >= todayStart }
            } else msgs
        }
        .combine(_sortOrder) { msgs, sort ->
            when (sort) {
                SortOrder.NEWEST -> msgs.sortedByDescending { it.receivedAt }
                SortOrder.OLDEST -> msgs.sortedBy { it.receivedAt }
                SortOrder.BY_SENDER -> msgs.sortedBy { it.sender.lowercase() }
                SortOrder.BY_APP -> msgs.sortedBy { it.appName.lowercase() }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allStatusSteps: StateFlow<List<StatusStepEntity>> = statusStepRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 통계
    val todayCount: StateFlow<Int> = messageRepository.getCountSince(todayStart)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val pendingCount: StateFlow<Int> = allStatusSteps
        .flatMapLatest { steps ->
            val firstStep = steps.firstOrNull()
            if (firstStep != null) messageRepository.getCountByStatus(firstStep.id)
            else flowOf(0)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val completedCount: StateFlow<Int> = allStatusSteps
        .flatMapLatest { steps ->
            val lastStep = steps.lastOrNull()
            if (lastStep != null) messageRepository.getCountByStatus(lastStep.id)
            else flowOf(0)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _statsCardExpanded = MutableStateFlow(appPreferences.statsCardExpanded)
    val statsCardExpanded: StateFlow<Boolean> = _statsCardExpanded

    fun toggleStatsCard() {
        val newValue = !_statsCardExpanded.value
        _statsCardExpanded.value = newValue
        appPreferences.statsCardExpanded = newValue
    }

    // 다중 선택
    private val _selectedIds = MutableStateFlow<Set<String>>(emptySet())
    val selectedIds: StateFlow<Set<String>> = _selectedIds

    private val _selectionMode = MutableStateFlow(false)
    val selectionMode: StateFlow<Boolean> = _selectionMode

    fun toggleSelection(id: String) {
        _selectedIds.value = _selectedIds.value.let {
            if (it.contains(id)) it - id else it + id
        }
        if (_selectedIds.value.isEmpty()) _selectionMode.value = false
    }

    fun enterSelectionMode(id: String) {
        _selectionMode.value = true
        _selectedIds.value = setOf(id)
    }

    fun exitSelectionMode() {
        _selectionMode.value = false
        _selectedIds.value = emptySet()
    }

    fun selectAll(ids: List<String>) {
        _selectedIds.value = ids.toSet()
    }

    fun bulkDelete() {
        val ids = _selectedIds.value.toList()
        viewModelScope.launch {
            messageRepository.softDeleteByIds(ids)
            exitSelectionMode()
        }
    }

    fun bulkUpdateStatus(statusId: String) {
        val ids = _selectedIds.value.toList()
        viewModelScope.launch {
            messageRepository.updateStatusByIds(ids, statusId)
            exitSelectionMode()
        }
    }

    fun setFilterStatus(id: String?) { _filterStatusId.value = id }
    fun setFilterCompletedToday(completedToday: Boolean) { _filterCompletedToday.value = completedToday }
    fun clearFilters() {
        _filterStatusId.value = null
        _filterCompletedToday.value = false
    }
    fun setSortOrder(order: SortOrder) { _sortOrder.value = order }

    fun updateMessageStatus(messageId: String, statusId: String) {
        viewModelScope.launch {
            val message = messageRepository.getById(messageId) ?: return@launch
            val steps = allStatusSteps.value
            val fromStep = steps.find { it.id == message.statusId }
            val toStep = steps.find { it.id == statusId }

            val history = parseStatusHistory(message.statusHistory).toMutableList()
            history.add(StatusChangeItem(
                fromStatusId = message.statusId,
                fromStatusName = fromStep?.name,
                toStatusId = statusId,
                toStatusName = toStep?.name ?: ""
            ))

            messageRepository.updateStatusWithHistory(
                messageId, statusId, serializeStatusHistory(history)
            )
        }
    }

    fun updateMessageCategory(messageId: String, categoryId: String) {
        viewModelScope.launch {
            messageRepository.updateCategory(messageId, categoryId)
        }
    }

    fun bulkUpdateCategory(categoryId: String) {
        val ids = _selectedIds.value.toList()
        viewModelScope.launch {
            messageRepository.updateCategoryByIds(ids, categoryId)
            exitSelectionMode()
        }
    }

    suspend fun getMessageById(id: String): CapturedMessageEntity? =
        messageRepository.getById(id)

    fun getMessageByIdFlow(id: String): Flow<CapturedMessageEntity?> =
        messageRepository.getByIdFlow(id)

    fun deleteMessage(message: CapturedMessageEntity) {
        viewModelScope.launch { messageRepository.delete(message) }
    }

    fun insertMessage(message: CapturedMessageEntity) {
        viewModelScope.launch { messageRepository.insert(message) }
    }

    fun updateComment(messageId: String, comment: String?) {
        viewModelScope.launch { messageRepository.updateComment(messageId, comment) }
    }

    fun updateContent(messageId: String, newContent: String) {
        viewModelScope.launch { messageRepository.updateContent(messageId, newContent) }
    }

    fun addComment(messageId: String, content: String) {
        viewModelScope.launch {
            val message = messageRepository.getById(messageId) ?: return@launch
            val comments = parseComments(message.comment).toMutableList()
            comments.add(com.hart.notimgmt.data.model.CommentItem(content = content))
            messageRepository.updateComment(messageId, serializeComments(comments))
        }
    }

    fun deleteComment(messageId: String, commentId: String) {
        viewModelScope.launch {
            val message = messageRepository.getById(messageId) ?: return@launch
            val comments = parseComments(message.comment).filter { it.id != commentId }
            messageRepository.updateComment(messageId, serializeComments(comments))
        }
    }

    fun archiveMessage(messageId: String) {
        viewModelScope.launch { messageRepository.setArchived(messageId, true) }
    }

    fun unarchiveMessage(messageId: String) {
        viewModelScope.launch { messageRepository.setArchived(messageId, false) }
    }

    fun togglePin(messageId: String) {
        viewModelScope.launch {
            val message = messageRepository.getById(messageId) ?: return@launch
            messageRepository.setPinned(messageId, !message.isPinned)
        }
    }

    fun snoozeMessage(messageId: String, snoozeAt: Long) {
        viewModelScope.launch {
            messageRepository.setSnooze(messageId, snoozeAt)
            snoozeManager.scheduleSnooze(messageId, snoozeAt)
        }
    }

    fun cancelSnooze(messageId: String) {
        viewModelScope.launch {
            messageRepository.clearSnooze(messageId)
            snoozeManager.cancelSnooze(messageId)
        }
    }

    // ── 휴지통 (Trash) ──

    val deletedMessages: StateFlow<List<CapturedMessageEntity>> =
        messageRepository.getDeleted()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val deletedCount: StateFlow<Int> =
        messageRepository.getDeletedCount()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    fun restoreMessage(messageId: String) {
        viewModelScope.launch { messageRepository.restore(messageId) }
    }

    fun bulkRestore() {
        val ids = _selectedIds.value.toList()
        viewModelScope.launch {
            messageRepository.restoreByIds(ids)
            exitSelectionMode()
        }
    }

    fun permanentDeleteMessage(messageId: String) {
        viewModelScope.launch { messageRepository.permanentDeleteByIds(listOf(messageId)) }
    }

    fun bulkPermanentDelete() {
        val ids = _selectedIds.value.toList()
        viewModelScope.launch {
            messageRepository.permanentDeleteByIds(ids)
            exitSelectionMode()
        }
    }

    fun emptyTrash() {
        viewModelScope.launch { messageRepository.emptyTrash() }
    }

    fun moveToNextStatus(message: CapturedMessageEntity) {
        viewModelScope.launch {
            val steps = allStatusSteps.value
            if (steps.isEmpty()) return@launch
            val currentIndex = steps.indexOfFirst { it.id == message.statusId }
            val nextIndex = if (currentIndex < 0) 0 else (currentIndex + 1).coerceAtMost(steps.lastIndex)
            val nextStep = steps[nextIndex]

            val fromStep = if (currentIndex >= 0) steps[currentIndex] else null
            val history = parseStatusHistory(message.statusHistory).toMutableList()
            history.add(StatusChangeItem(
                fromStatusId = message.statusId,
                fromStatusName = fromStep?.name,
                toStatusId = nextStep.id,
                toStatusName = nextStep.name
            ))

            messageRepository.updateStatusWithHistory(
                message.id, nextStep.id, serializeStatusHistory(history)
            )
        }
    }
}
