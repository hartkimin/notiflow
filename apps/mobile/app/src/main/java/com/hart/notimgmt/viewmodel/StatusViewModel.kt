package com.hart.notimgmt.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.data.repository.StatusStepRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StatusViewModel @Inject constructor(
    private val statusStepRepository: StatusStepRepository
) : ViewModel() {

    val steps: StateFlow<List<StatusStepEntity>> = statusStepRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun addStep(name: String, color: Int) {
        viewModelScope.launch {
            val nextOrder = statusStepRepository.getMaxOrderIndex() + 1
            statusStepRepository.insert(
                StatusStepEntity(name = name, orderIndex = nextOrder, color = color)
            )
        }
    }

    fun updateStep(step: StatusStepEntity) {
        viewModelScope.launch { statusStepRepository.update(step) }
    }

    fun deleteStep(step: StatusStepEntity) {
        viewModelScope.launch { statusStepRepository.delete(step) }
    }

    fun reorderSteps(reordered: List<StatusStepEntity>) {
        viewModelScope.launch {
            val updated = reordered.mapIndexed { index, step -> step.copy(orderIndex = index) }
            statusStepRepository.updateAll(updated)
        }
    }
}
