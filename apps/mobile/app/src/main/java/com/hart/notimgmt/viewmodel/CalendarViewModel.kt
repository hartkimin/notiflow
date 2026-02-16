package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.db.dao.DayCategory
import com.hart.notimgmt.data.db.dao.StatusCount
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.preferences.AppPreferences.Companion.UNCATEGORIZED_ID
import com.hart.notimgmt.data.repository.CategoryRepository
import com.hart.notimgmt.data.repository.MessageRepository
import com.hart.notimgmt.data.repository.StatusStepRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import javax.inject.Inject

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    private val categoryRepository: CategoryRepository,
    private val statusStepRepository: StatusStepRepository,
    private val appPreferences: AppPreferences
) : ViewModel() {

    val categories = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allStatusSteps: StateFlow<List<StatusStepEntity>> = statusStepRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 숨김 카테고리
    private val hiddenCategoryIds = appPreferences.hiddenCategoryIdsFlow

    // 캘린더에서 선택된 카테고리 필터 (null = 전체)
    private val _selectedCategoryIds = MutableStateFlow<Set<String>?>(null)
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

    private fun List<CapturedMessageEntity>.filterByCategory(
        hidden: Set<String>,
        selected: Set<String>?
    ): List<CapturedMessageEntity> {
        var filtered = this

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

        return filtered
    }

    private val _currentMonth = MutableStateFlow(YearMonth.now())
    val currentMonth: StateFlow<YearMonth> = _currentMonth

    private val _selectedDate = MutableStateFlow<LocalDate?>(null)
    val selectedDate: StateFlow<LocalDate?> = _selectedDate

    val messageDaysInMonth: StateFlow<List<DayCategory>> = _currentMonth
        .flatMapLatest { month ->
            val start = month.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            val end = month.atEndOfMonth().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            messageRepository.getMessageDaysInMonth(start, end)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val messagesForSelectedDate: StateFlow<List<CapturedMessageEntity>> = combine(
        _selectedDate, hiddenCategoryIds, _selectedCategoryIds
    ) { date, hidden, selected -> Triple(date, hidden, selected) }
        .flatMapLatest { (date, hidden, selected) ->
            if (date != null) {
                val start = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                val end = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                messageRepository.getByDateRange(start, end).map { it.filterByCategory(hidden, selected) }
            } else flowOf(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val statusCountsForSelectedDate: StateFlow<List<StatusCount>> = _selectedDate
        .flatMapLatest { date ->
            if (date != null) {
                val start = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                val end = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                messageRepository.getStatusCountsByDateRange(start, end)
            } else flowOf(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun previousMonth() { _currentMonth.value = _currentMonth.value.minusMonths(1) }
    fun nextMonth() { _currentMonth.value = _currentMonth.value.plusMonths(1) }
    fun selectDate(date: LocalDate) { _selectedDate.value = date }

    fun goToDate(date: LocalDate) {
        _selectedDate.value = date
        val newMonth = YearMonth.from(date)
        if (newMonth != _currentMonth.value) _currentMonth.value = newMonth
    }

    fun selectPreviousDate() {
        val current = _selectedDate.value ?: LocalDate.now()
        goToDate(current.minusDays(1))
    }

    fun selectNextDate() {
        val current = _selectedDate.value ?: LocalDate.now()
        goToDate(current.plusDays(1))
    }

    fun updateMessageStatus(messageId: String, statusId: String) {
        viewModelScope.launch { messageRepository.updateStatus(messageId, statusId) }
    }

    fun deleteMessage(message: CapturedMessageEntity) {
        viewModelScope.launch { messageRepository.delete(message) }
    }
}
