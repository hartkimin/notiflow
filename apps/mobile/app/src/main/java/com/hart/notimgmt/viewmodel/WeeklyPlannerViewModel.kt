package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.data.db.entity.DayCategoryEntity
import com.hart.notimgmt.data.db.entity.PlanEntity
import com.hart.notimgmt.data.repository.CategoryRepository
import com.hart.notimgmt.data.repository.DayCategoryRepository
import com.hart.notimgmt.data.repository.MessageRepository
import com.hart.notimgmt.data.repository.PlanRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters
import javax.inject.Inject

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class WeeklyPlannerViewModel @Inject constructor(
    private val planRepository: PlanRepository,
    private val categoryRepository: CategoryRepository,
    private val messageRepository: MessageRepository,
    private val dayCategoryRepository: DayCategoryRepository
) : ViewModel() {

    val categories: StateFlow<List<CategoryEntity>> = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _currentWeekMonday = MutableStateFlow(getMonday(LocalDate.now()))
    val currentWeekMonday: StateFlow<LocalDate> = _currentWeekMonday.asStateFlow()

    val weekPlans: StateFlow<List<PlanEntity>> = _currentWeekMonday.flatMapLatest { monday ->
        val start = monday.toEpochMillis()
        val end = monday.plusDays(7).toEpochMillis()
        planRepository.getByDateRange(start, end)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val weekMessages: StateFlow<List<CapturedMessageEntity>> = _currentWeekMonday.flatMapLatest { monday ->
        val start = monday.toEpochMillis()
        val end = monday.plusDays(7).toEpochMillis()
        messageRepository.getByDateRange(start, end)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val weekDayCategories: StateFlow<List<DayCategoryEntity>> = _currentWeekMonday.flatMapLatest { monday ->
        val start = monday.toEpochMillis()
        val end = monday.plusDays(7).toEpochMillis()
        dayCategoryRepository.getByDateRange(start, end)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val uncategorizedMessages: StateFlow<List<CapturedMessageEntity>> =
        messageRepository.getUncategorized()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // ========== Day Category management ==========

    fun addCategoryToDay(date: LocalDate, categoryId: String) {
        viewModelScope.launch {
            dayCategoryRepository.addCategoryToDay(date.toEpochMillis(), categoryId)
        }
    }

    fun removeCategoryFromDay(date: LocalDate, categoryId: String) {
        viewModelScope.launch {
            dayCategoryRepository.removeCategoryFromDay(date.toEpochMillis(), categoryId)
        }
    }

    // ========== Week navigation ==========

    fun goToNextWeek() {
        _currentWeekMonday.value = _currentWeekMonday.value.plusWeeks(1)
    }

    fun goToPreviousWeek() {
        _currentWeekMonday.value = _currentWeekMonday.value.minusWeeks(1)
    }

    fun goToThisWeek() {
        _currentWeekMonday.value = getMonday(LocalDate.now())
    }

    fun goToWeekContaining(date: LocalDate) {
        _currentWeekMonday.value = getMonday(date)
    }

    // ========== Plan CRUD ==========

    fun addPlan(categoryId: String?, date: LocalDate, title: String) {
        viewModelScope.launch {
            val dateMillis = date.toEpochMillis()
            val maxIndex = planRepository.getMaxOrderIndex(dateMillis, categoryId)
            val plan = PlanEntity(
                categoryId = categoryId,
                date = dateMillis,
                title = title,
                orderIndex = maxIndex + 1
            )
            planRepository.insert(plan)
        }
    }

    fun togglePlanCompletion(planId: String, isCompleted: Boolean) {
        viewModelScope.launch {
            planRepository.toggleCompletion(planId, isCompleted)
        }
    }

    fun updatePlan(plan: PlanEntity) {
        viewModelScope.launch {
            planRepository.update(plan)
        }
    }

    fun deletePlan(plan: PlanEntity) {
        viewModelScope.launch {
            planRepository.delete(plan)
        }
    }

    fun copyCurrentWeekToNext() {
        viewModelScope.launch {
            val currentMonday = _currentWeekMonday.value
            val nextMonday = currentMonday.plusWeeks(1)
            planRepository.copyWeek(
                sourceStart = currentMonday.toEpochMillis(),
                targetStart = nextMonday.toEpochMillis()
            )
        }
    }

    fun copyPreviousDayForCategory(categoryId: String, date: LocalDate) {
        viewModelScope.launch {
            planRepository.copyPreviousDayForCategory(categoryId, date.toEpochMillis())
        }
    }

    fun addAllCategoriesToWeek() {
        viewModelScope.launch {
            val activeCategories = categories.value.filter { it.isActive && !it.isDeleted }
            if (activeCategories.isEmpty()) return@launch
            dayCategoryRepository.addAllCategoriesToWeek(
                weekStartMillis = _currentWeekMonday.value.toEpochMillis(),
                categoryIds = activeCategories.map { it.id }
            )
        }
    }

    fun copyPreviousWeekToCurrent() {
        viewModelScope.launch {
            val currentMonday = _currentWeekMonday.value
            val previousMonday = currentMonday.minusWeeks(1)
            planRepository.copyWeek(
                sourceStart = previousMonday.toEpochMillis(),
                targetStart = currentMonday.toEpochMillis()
            )
        }
    }

    // ========== Helpers ==========

    companion object {
        fun getMonday(date: LocalDate): LocalDate =
            date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))

        fun LocalDate.toEpochMillis(): Long =
            atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    }
}
