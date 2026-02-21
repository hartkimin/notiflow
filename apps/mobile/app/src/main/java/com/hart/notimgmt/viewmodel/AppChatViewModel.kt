package com.hart.notimgmt.viewmodel

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.repository.MessageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AppChatViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val sourceEncoded: String = checkNotNull(savedStateHandle["source"])
    private val roomIdEncoded: String = checkNotNull(savedStateHandle["sender"]) // the nav arg is "sender" but represents roomId

    val source: String = Uri.decode(sourceEncoded)
    val roomId: String = Uri.decode(roomIdEncoded)

    val messages: StateFlow<List<CapturedMessageEntity>> = messageRepository.getMessagesByRoomAscFlow(source, roomId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 전체 삭제 후 화면 닫기 이벤트
    private val _roomCleared = MutableSharedFlow<Unit>()
    val roomCleared = _roomCleared.asSharedFlow()

    fun deleteMessage(id: String) {
        viewModelScope.launch {
            messageRepository.softDeleteByIds(listOf(id))
        }
    }

    fun deleteAllMessages() {
        viewModelScope.launch {
            val ids = messages.value.map { it.id }
            if (ids.isNotEmpty()) {
                messageRepository.softDeleteByIds(ids)
                _roomCleared.emit(Unit)
            }
        }
    }
}
