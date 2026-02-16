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
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class KanbanViewModel @Inject constructor(
    private val statusStepRepository: StatusStepRepository,
    private val messageRepository: MessageRepository,
    private val categoryRepository: CategoryRepository,
    private val appPreferences: AppPreferences
) : ViewModel() {

    val steps: StateFlow<List<StatusStepEntity>> = statusStepRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 카테고리 목록
    val categories: StateFlow<List<CategoryEntity>> = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 숨김 카테고리 (전역 설정)
    private val hiddenCategoryIds = appPreferences.hiddenCategoryIdsFlow

    // 보드에서 선택된 카테고리 필터 (null = 전체, UNCATEGORIZED_ID = 미분류, UUID = 특정 카테고리)
    private val _selectedCategoryIds = MutableStateFlow<Set<String>?>(null) // null = 전체 선택
    val selectedCategoryIds: StateFlow<Set<String>?> = _selectedCategoryIds

    // 필터 표시 여부
    private val _showCategoryFilter = MutableStateFlow(false)
    val showCategoryFilter: StateFlow<Boolean> = _showCategoryFilter

    fun toggleCategoryFilter() {
        _showCategoryFilter.value = !_showCategoryFilter.value
    }

    fun toggleCategorySelection(categoryId: String) {
        val current = _selectedCategoryIds.value
        if (current == null) {
            // 전체 선택 상태에서 특정 카테고리 클릭 → 해당 카테고리만 선택
            _selectedCategoryIds.value = setOf(categoryId)
        } else if (current.contains(categoryId)) {
            // 이미 선택된 카테고리 클릭 → 선택 해제
            val newSet = current - categoryId
            _selectedCategoryIds.value = if (newSet.isEmpty()) null else newSet
        } else {
            // 선택 안된 카테고리 클릭 → 선택 추가
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

    private val allMessages: StateFlow<List<CapturedMessageEntity>> = combine(
        messageRepository.getAll(), hiddenCategoryIds, _selectedCategoryIds
    ) { messages, hidden, selected ->
        var filtered = messages

        // 숨김 카테고리 필터 적용
        if (hidden.isNotEmpty()) {
            filtered = filtered.filter { msg ->
                val catId = msg.categoryId ?: UNCATEGORIZED_ID
                !hidden.contains(catId)
            }
        }

        // 선택된 카테고리 필터 적용
        if (selected != null) {
            filtered = filtered.filter { msg ->
                val catId = msg.categoryId ?: UNCATEGORIZED_ID
                selected.contains(catId)
            }
        }

        filtered
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Messages grouped by statusId (null key = unassigned)
    val messagesByStatus: StateFlow<Map<String?, List<CapturedMessageEntity>>> =
        allMessages.map { messages ->
            messages.groupBy { it.statusId }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    fun updateMessageStatus(messageId: String, statusId: String) {
        viewModelScope.launch {
            messageRepository.updateStatus(messageId, statusId)
        }
    }

    fun deleteMessage(message: CapturedMessageEntity) {
        viewModelScope.launch { messageRepository.delete(message) }
    }
}
