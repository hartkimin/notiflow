package com.hart.notimgmt.ui.chat

import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.foundation.background
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.viewmodel.AppChatViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppChatScreen(
    source: String,
    sender: String,
    onBack: () -> Unit,
    onMessageClick: (String) -> Unit,
    viewModel: AppChatViewModel = hiltViewModel()
) {
    val messages by viewModel.messages.collectAsState()
    val decodedSender = Uri.decode(sender)
    
    val appName = messages.firstOrNull()?.appName ?: decodedSender
    val title = if (decodedSender.isNotEmpty() && decodedSender != appName) "$decodedSender ($appName)" else appName

    val groupedMessages = remember(messages) {
        messages.groupBy { 
            SimpleDateFormat("yyyy년 M월 d일 E요일", Locale.getDefault()).format(Date(it.receivedAt))
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            reverseLayout = true
        ) {
            groupedMessages.forEach { (dateStr, msgs) ->
                itemsIndexed(
                    items = msgs,
                    key = { _, msg -> msg.id }
                ) { index, msg ->
                    val isFirstInGroup = index == msgs.lastIndex
                    val isLastInGroup = index == 0
                    ChatBubble(
                        message = msg,
                        isFirst = isFirstInGroup,
                        isLast = isLastInGroup,
                        onClick = { onMessageClick(msg.id) }
                    )
                }
                item {
                    DateHeader(dateStr)
                }
            }
        }
    }
}

@Composable
fun DateHeader(dateStr: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
            shadowElevation = 1.dp
        ) {
            Text(
                text = dateStr,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
            )
        }
    }
}

@Composable
fun ChatBubble(
    message: CapturedMessageEntity,
    isFirst: Boolean,
    isLast: Boolean,
    onClick: () -> Unit
) {
    // Determine the corner radii to group consecutive bubbles from the same sender
    val topStartRadius = if (isFirst) 20.dp else 4.dp
    val bottomStartRadius = if (isLast) 20.dp else 4.dp

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .padding(vertical = if (isLast) 8.dp else 2.dp),
        horizontalArrangement = Arrangement.Start
    ) {
        // Timeline graphic column
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .width(40.dp)
                .fillMaxHeight()
        ) {
            // Top segment of timeline line
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .weight(0.2f)
                    .background(if (isFirst) Color.Transparent else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
            )
            
            // Timeline Dot
            if (isFirst) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50))
                )
            } else {
                Box(modifier = Modifier.size(10.dp)) // Spacer for alignment
            }

            // Bottom segment of timeline line
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .weight(0.8f)
                    .background(if (isLast) Color.Transparent else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
            )
        }

        // Message Content column
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 40.dp) // Leave space on the right side
        ) {
            // Subtext/Sender name if applicable, shown only on the first message of a block
            if (isFirst && message.roomName != null && message.sender != message.roomName) {
                Text(
                    text = message.sender,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(bottom = 4.dp, start = 4.dp)
                )
            }

            // The main bubble
            Surface(
                shape = RoundedCornerShape(
                    topStart = topStartRadius,
                    topEnd = 20.dp,
                    bottomEnd = 20.dp,
                    bottomStart = bottomStartRadius
                ),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.clickable(onClick = onClick)
            ) {
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
                )
            }
            
            // Timestamp, shown only on the last message of a block
            if (isLast) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatChatDetailTime(message.receivedAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                    modifier = Modifier.padding(start = 4.dp)
                )
            }
        }
    }
}

private fun formatChatDetailTime(timestamp: Long): String {
    return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(timestamp))
}
