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
import android.graphics.Bitmap
import com.hart.notimgmt.ai.AiMessageClassifier
import com.hart.notimgmt.ai.AiModelManager
import com.hart.notimgmt.ai.GemmaModelSize
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.Calendar
import javax.inject.Inject

sealed class AiAnalysisState {
    data object Idle : AiAnalysisState()
    data object ModelNotReady : AiAnalysisState()
    data object Analyzing : AiAnalysisState()
    data class Completed(val result: String) : AiAnalysisState()
    data class Error(val message: String) : AiAnalysisState()
}

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class MessageViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    private val categoryRepository: CategoryRepository,
    private val statusStepRepository: StatusStepRepository,
    private val appPreferences: AppPreferences,
    private val snoozeManager: SnoozeManager,
    private val classifier: AiMessageClassifier,
    private val modelManager: AiModelManager
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

    // AI Analysis
    private companion object {
        const val MAX_ANALYSIS_LENGTH = 500
        const val STREAMING_UPDATE_INTERVAL = 30 // 30자마다 UI 갱신
    }

    private val _aiAnalysisState = MutableStateFlow<AiAnalysisState>(AiAnalysisState.Idle)
    val aiAnalysisState: StateFlow<AiAnalysisState> = _aiAnalysisState

    private val _aiStreamingText = MutableStateFlow("")
    val aiStreamingText: StateFlow<String> = _aiStreamingText

    private var aiAnalysisJob: Job? = null

    val isModelDownloaded: Boolean
        get() = modelManager.isModelDownloaded(appPreferences.aiModelSize)

    val currentModelSize: GemmaModelSize
        get() = appPreferences.aiModelSize

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

    // ===== AI Analysis =====

    fun analyzeWithAi(content: String, attachedImage: Bitmap? = null) {
        if (_aiAnalysisState.value is AiAnalysisState.Analyzing) return

        if (!isModelDownloaded) {
            _aiAnalysisState.value = AiAnalysisState.ModelNotReady
            return
        }

        _aiAnalysisState.value = AiAnalysisState.Analyzing
        _aiStreamingText.value = ""

        val selectedPreset = getSelectedPreset()
        val prompt = buildAnalysisPrompt(content, selectedPreset?.content)

        aiAnalysisJob = viewModelScope.launch {
            try {
                val accumulated = StringBuilder()
                var lastUpdateLength = 0
                val result = classifier.generate(
                    modelSize = appPreferences.aiModelSize,
                    prompt = prompt,
                    image = attachedImage,
                    onPartialResult = { chunk ->
                        accumulated.append(chunk)
                        val currentLen = accumulated.length
                        if (currentLen <= MAX_ANALYSIS_LENGTH &&
                            currentLen - lastUpdateLength >= STREAMING_UPDATE_INTERVAL
                        ) {
                            lastUpdateLength = currentLen
                            _aiStreamingText.value = accumulated.toString()
                        }
                    }
                )
                val trimmed = result?.trim() ?: "분석 결과를 생성하지 못했습니다."
                val finalResult = if (trimmed.length > MAX_ANALYSIS_LENGTH) {
                    trimmed.take(MAX_ANALYSIS_LENGTH) + "…"
                } else trimmed
                _aiAnalysisState.value = AiAnalysisState.Completed(finalResult)
            } catch (e: Exception) {
                _aiAnalysisState.value = AiAnalysisState.Error(
                    e.message ?: "알 수 없는 오류가 발생했습니다."
                )
            } finally {
                _aiStreamingText.value = ""
            }
        }
    }

    fun saveAnalysisAsComment(messageId: String) {
        val state = _aiAnalysisState.value
        if (state !is AiAnalysisState.Completed) return

        val preset = getSelectedPreset()
        val prefix = if (preset != null) "[AI] ${preset.name}" else "[AI]"
        val commentContent = "$prefix: ${state.result}"

        viewModelScope.launch {
            val message = messageRepository.getById(messageId) ?: return@launch
            val comments = parseComments(message.comment).toMutableList()
            comments.add(com.hart.notimgmt.data.model.CommentItem(content = commentContent))
            messageRepository.updateComment(messageId, serializeComments(comments))
            _aiAnalysisState.value = AiAnalysisState.Idle
            _aiStreamingText.value = ""
        }
    }

    fun clearAnalysis() {
        aiAnalysisJob?.cancel()
        aiAnalysisJob = null
        _aiAnalysisState.value = AiAnalysisState.Idle
        _aiStreamingText.value = ""
    }

    fun getPresets(): List<PromptPreset> {
        return parseAnalysisPresets(appPreferences.aiPromptPresets)
    }

    fun getSelectedPresetId(): String {
        return appPreferences.aiSelectedPresetId
    }

    fun selectAnalysisPreset(id: String) {
        val newId = if (appPreferences.aiSelectedPresetId == id) "" else id
        appPreferences.aiSelectedPresetId = newId
    }

    private fun getSelectedPreset(): PromptPreset? {
        val selectedId = appPreferences.aiSelectedPresetId
        if (selectedId.isBlank()) return null
        return getPresets().firstOrNull { it.id == selectedId }
    }

    private fun buildAnalysisPrompt(content: String, presetInstruction: String?): String {
        val sb = StringBuilder()
        sb.append("<start_of_turn>user\n")
        sb.append("[중요] 응답은 반드시 ${MAX_ANALYSIS_LENGTH}자 이내로 간결하게 작성해.\n\n")
        if (!presetInstruction.isNullOrBlank()) {
            sb.append("[지침] $presetInstruction\n\n")
        }
        sb.append("다음 알림 메시지를 분석해줘:\n\n")
        sb.append(content)
        sb.append("\n<end_of_turn>\n")
        sb.append("<start_of_turn>model\n")
        return sb.toString()
    }

    private fun parseAnalysisPresets(json: String): List<PromptPreset> {
        return try {
            val arr = org.json.JSONArray(json)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                PromptPreset(
                    id = obj.getString("id"),
                    name = obj.getString("name"),
                    content = obj.getString("content")
                )
            }
        } catch (e: Exception) {
            emptyList()
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
