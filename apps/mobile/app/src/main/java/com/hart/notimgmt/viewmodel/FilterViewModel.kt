package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.db.entity.AppFilterEntity
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.data.db.entity.FilterRuleEntity
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.repository.AppFilterRepository
import com.hart.notimgmt.data.repository.CategoryRepository
import com.hart.notimgmt.data.repository.FilterRuleRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class FilterViewModel @Inject constructor(
    private val categoryRepository: CategoryRepository,
    private val filterRuleRepository: FilterRuleRepository,
    private val appFilterRepository: AppFilterRepository,
    private val appPreferences: AppPreferences
) : ViewModel() {

    val categories: StateFlow<List<CategoryEntity>> = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allowedApps: StateFlow<List<AppFilterEntity>> = appFilterRepository.getAll()
        .map { list -> list.filter { it.isAllowed && !it.isDeleted } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val smsCaptureEnabled: Boolean get() = appPreferences.smsCaptureEnabled

    private val _sortByName = MutableStateFlow(appPreferences.categorySortByName)
    val sortByName: StateFlow<Boolean> = _sortByName

    fun toggleSortByName() {
        val newValue = !_sortByName.value
        _sortByName.value = newValue
        appPreferences.categorySortByName = newValue
    }

    private val _selectedCategoryId = MutableStateFlow<String?>(null)
    val selectedCategoryId: StateFlow<String?> = _selectedCategoryId

    val rulesForCategory: StateFlow<List<FilterRuleEntity>> = _selectedCategoryId
        .flatMapLatest { id ->
            if (id != null) filterRuleRepository.getByCategoryId(id) else flowOf(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun selectCategory(id: String?) { _selectedCategoryId.value = id }

    fun addCategory(name: String, color: Int) {
        viewModelScope.launch {
            categoryRepository.insert(
                CategoryEntity(name = name, color = color, orderIndex = categories.value.size)
            )
        }
    }

    fun updateCategory(category: CategoryEntity) {
        viewModelScope.launch { categoryRepository.update(category) }
    }

    fun deleteCategory(category: CategoryEntity) {
        viewModelScope.launch { categoryRepository.delete(category) }
    }

    fun toggleCategoryActive(category: CategoryEntity) {
        viewModelScope.launch {
            categoryRepository.setActive(category.id, !category.isActive)
        }
    }

    fun addRule(rule: FilterRuleEntity) {
        viewModelScope.launch {
            filterRuleRepository.insert(rule)
        }
    }

    fun updateRule(rule: FilterRuleEntity) {
        viewModelScope.launch { filterRuleRepository.update(rule) }
    }

    fun reorderCategories(reorderedList: List<CategoryEntity>) {
        val updated = reorderedList.mapIndexed { index, cat ->
            cat.copy(orderIndex = index)
        }
        viewModelScope.launch { categoryRepository.reorderCategories(updated) }
    }

    fun deleteRule(rule: FilterRuleEntity) {
        viewModelScope.launch { filterRuleRepository.delete(rule) }
    }

    fun copyCategory(category: CategoryEntity) {
        viewModelScope.launch {
            val newCategory = CategoryEntity(
                name = "${category.name} (복사)",
                color = category.color,
                orderIndex = categories.value.size,
                isActive = category.isActive
            )
            val newCategoryId = categoryRepository.insert(newCategory)

            val rules = filterRuleRepository.getByCategoryIdOnce(category.id)
            rules.forEach { rule ->
                filterRuleRepository.insert(
                    FilterRuleEntity(
                        categoryId = newCategoryId,
                        senderKeywords = rule.senderKeywords,
                        includeWords = rule.includeWords,
                        conditionType = rule.conditionType,
                        targetAppPackages = rule.targetAppPackages,
                        isActive = rule.isActive
                    )
                )
            }
        }
    }
}
