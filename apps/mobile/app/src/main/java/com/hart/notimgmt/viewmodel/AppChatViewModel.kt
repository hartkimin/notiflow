package com.hart.notimgmt.viewmodel

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.repository.MessageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class AppChatViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val sourceEncoded: String = checkNotNull(savedStateHandle["source"])
    private val senderEncoded: String = checkNotNull(savedStateHandle["sender"])

    val source: String = Uri.decode(sourceEncoded)
    val sender: String = Uri.decode(senderEncoded)

    val messages: StateFlow<List<CapturedMessageEntity>> = messageRepository.getMessagesBySenderFlow(source, sender)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}
