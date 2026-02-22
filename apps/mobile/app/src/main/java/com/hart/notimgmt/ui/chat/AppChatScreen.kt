package com.hart.notimgmt.ui.chat

import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.viewmodel.AppChatViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Flat list item: either a message, a date separator, or an unread divider. */
private sealed class ChatItem {
    data class MessageItem(
        val message: CapturedMessageEntity,
        val isGroupStart: Boolean,
        val isGroupEnd: Boolean,
    ) : ChatItem()

    data class DateItem(val dateStr: String) : ChatItem()
    data object UnreadDivider : ChatItem()
}

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
    val decodedSource = Uri.decode(source)
    val style = rememberAppChatStyle(decodedSource)

    val appName = messages.firstOrNull()?.appName ?: decodedSender
    val title = if (decodedSender.isNotEmpty() && decodedSender != appName)
        "$decodedSender ($appName)" else appName

    // 메뉴 & 삭제 다이얼로그 상태
    var showMenu by remember { mutableStateOf(false) }
    var showDeleteAllDialog by remember { mutableStateOf(false) }
    var messageToDelete by remember { mutableStateOf<CapturedMessageEntity?>(null) }

    // 전체 삭제 완료 시 화면 닫기
    LaunchedEffect(Unit) {
        viewModel.roomCleared.collect { onBack() }
    }

    // 읽지 않은 메시지의 첫 번째 인덱스를 최초 로드 시 한 번만 캡처
    var initialUnreadIndex by remember { mutableIntStateOf(-1) }
    var unreadCaptured by remember { mutableStateOf(false) }

    LaunchedEffect(messages) {
        if (!unreadCaptured && messages.isNotEmpty()) {
            initialUnreadIndex = messages.indexOfFirst { !it.isRead }
            unreadCaptured = true
            viewModel.markAllAsRead()
        }
    }

    // ASC: index 0 = oldest, last = newest
    // Date header goes BEFORE the first message of each date
    val chatItems = remember(messages, initialUnreadIndex) {
        buildList {
            var unreadDividerInserted = false
            messages.forEachIndexed { index, msg ->
                val currentDate = formatDateKey(msg.receivedAt)
                val prevMsg = messages.getOrNull(index - 1)
                val nextMsg = messages.getOrNull(index + 1)
                val prevDate = prevMsg?.let { formatDateKey(it.receivedAt) }
                val nextDate = nextMsg?.let { formatDateKey(it.receivedAt) }

                // Insert date header when date changes from previous message (or first message)
                if (prevDate == null || currentDate != prevDate) {
                    add(ChatItem.DateItem(currentDate))
                }

                // Insert unread divider before the first unread message
                if (!unreadDividerInserted && index == initialUnreadIndex) {
                    add(ChatItem.UnreadDivider)
                    unreadDividerInserted = true
                }

                // Sender grouping: break at sender change OR date boundary
                val isGroupStart =
                    prevMsg == null || prevMsg.sender != msg.sender || prevDate != currentDate
                val isGroupEnd =
                    nextMsg == null || nextMsg.sender != msg.sender || nextDate != currentDate

                add(ChatItem.MessageItem(msg, isGroupStart, isGroupEnd))
            }
        }
    }

    val listState = rememberLazyListState()

    // Auto-scroll: to unread divider if present, otherwise to bottom
    LaunchedEffect(messages.size) {
        if (chatItems.isNotEmpty()) {
            val unreadDividerIndex = chatItems.indexOfFirst { it is ChatItem.UnreadDivider }
            val scrollTarget = if (unreadDividerIndex >= 0) unreadDividerIndex else chatItems.lastIndex
            listState.scrollToItem(scrollTarget)
        }
    }

    // 전체 삭제 확인 다이얼로그
    if (showDeleteAllDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteAllDialog = false },
            title = { Text("전체 메시지 삭제") },
            text = { Text("이 대화방의 모든 메시지(${messages.size}건)를 삭제하시겠습니까?\n삭제된 메시지는 휴지통에서 복원할 수 있습니다.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteAllDialog = false
                        viewModel.deleteAllMessages()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) { Text("삭제") }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteAllDialog = false }) { Text("취소") }
            }
        )
    }

    // 개별 메시지 삭제 확인 다이얼로그
    messageToDelete?.let { msg ->
        AlertDialog(
            onDismissRequest = { messageToDelete = null },
            title = { Text("메시지 삭제") },
            text = {
                Text(
                    "이 메시지를 삭제하시겠습니까?\n\n\"${msg.content.take(50)}${if (msg.content.length > 50) "..." else ""}\"\n\n삭제된 메시지는 휴지통에서 복원할 수 있습니다."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteMessage(msg.id)
                        messageToDelete = null
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) { Text("삭제") }
            },
            dismissButton = {
                TextButton(onClick = { messageToDelete = null }) { Text("취소") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "메뉴")
                        }
                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        "전체 삭제",
                                        color = MaterialTheme.colorScheme.error
                                    )
                                },
                                onClick = {
                                    showMenu = false
                                    showDeleteAllDialog = true
                                },
                                enabled = messages.isNotEmpty()
                            )
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 16.dp)
        ) {
            items(
                count = chatItems.size,
                key = { index ->
                    when (val item = chatItems[index]) {
                        is ChatItem.MessageItem -> item.message.id
                        is ChatItem.DateItem -> "date_${item.dateStr}"
                        is ChatItem.UnreadDivider -> "unread_divider"
                    }
                }
            ) { index ->
                val item = chatItems[index]
                val isFirst = index == 0
                val isLast = index == chatItems.lastIndex

                when (item) {
                    is ChatItem.MessageItem -> TimelineMessageRow(
                        item = item,
                        style = style,
                        isFirst = isFirst,
                        isLast = isLast,
                        onClick = { onMessageClick(item.message.id) },
                        onLongClick = { messageToDelete = item.message }
                    )
                    is ChatItem.DateItem -> TimelineDateHeader(
                        dateStr = item.dateStr,
                        style = style
                    )
                    is ChatItem.UnreadDivider -> UnreadDividerRow()
                }
            }
        }
    }
}

// ── Message row: [AppIcon/dot 48dp + time] [connecting line] [Message Card] ──

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TimelineMessageRow(
    item: ChatItem.MessageItem,
    style: AppChatStyle,
    isFirst: Boolean,
    isLast: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit = {}
) {
    val message = item.message
    val context = LocalContext.current
    val bottomPadding = if (item.isGroupEnd) 6.dp else 2.dp
    val showSender =
        item.isGroupStart && message.roomName != null && message.sender != message.roomName

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .padding(bottom = bottomPadding),
        verticalAlignment = Alignment.Top
    ) {
        // ── Timeline column (48dp): icon/dot + time + connecting line ──
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .width(48.dp)
                .fillMaxHeight()
        ) {
            if (item.isGroupStart) {
                // App icon for group start
                val appIconBitmap = remember(message.source) {
                    try {
                        val drawable = context.packageManager.getApplicationIcon(message.source)
                        val size = 64
                        val bmp = android.graphics.Bitmap.createBitmap(
                            size, size, android.graphics.Bitmap.Config.ARGB_8888
                        )
                        val canvas = android.graphics.Canvas(bmp)
                        drawable.setBounds(0, 0, size, size)
                        drawable.draw(canvas)
                        bmp.asImageBitmap()
                    } catch (_: Exception) { null }
                }

                Spacer(modifier = Modifier.height(4.dp))

                if (appIconBitmap != null) {
                    Image(
                        bitmap = appIconBitmap,
                        contentDescription = message.appName,
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(style.accentColor.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (message.source.contains("sms", ignoreCase = true))
                                Icons.Default.Sms else Icons.Default.Notifications,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = style.accentColor
                        )
                    }
                }
            } else {
                // Small dot for continuation messages
                Spacer(modifier = Modifier.height(10.dp))
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .background(style.timelineDotColor, CircleShape)
                )
            }

            // Time display
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = formatChatDetailTime(message.receivedAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                maxLines = 1
            )

            // Connecting line (not on last item)
            if (!isLast) {
                Spacer(modifier = Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .weight(1f)
                        .background(style.timelineLineColor)
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        // ── Message content column ──
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 12.dp)
        ) {
            // Sender name (only at group start when in a room)
            if (showSender) {
                // Sender profile image
                val senderBitmap = remember(message.senderIcon) {
                    message.senderIcon?.let {
                        try {
                            val bytes = android.util.Base64.decode(it, android.util.Base64.NO_WRAP)
                            android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                                ?.asImageBitmap()
                        } catch (_: Exception) { null }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(bottom = 4.dp, start = 4.dp)
                ) {
                    if (senderBitmap != null) {
                        Image(
                            bitmap = senderBitmap,
                            contentDescription = "프로필",
                            modifier = Modifier
                                .size(18.dp)
                                .clip(CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                    }
                    Text(
                        text = message.sender,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = style.senderNameColor
                    )
                }
            }

            // Styled message card
            Surface(
                shape = style.bubbleShape,
                color = style.bubbleBackground,
                border = BorderStroke(0.5.dp, style.bubbleBorderColor),
                modifier = Modifier.combinedClickable(
                    onClick = onClick,
                    onLongClick = onLongClick
                )
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    // Message body (full text — detail screen, no maxLines)
                    Text(
                        text = message.content,
                        style = MaterialTheme.typography.bodyLarge,
                        color = style.bubbleOnBackground
                    )

                    // Attached image
                    if (message.attachedImage != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        val imageBitmap = remember(message.attachedImage) {
                            try {
                                val bytes = android.util.Base64.decode(
                                    message.attachedImage, android.util.Base64.NO_WRAP
                                )
                                android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                                    ?.asImageBitmap()
                            } catch (_: Exception) { null }
                        }
                        if (imageBitmap != null) {
                            Image(
                                bitmap = imageBitmap,
                                contentDescription = "첨부 이미지",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── Date header: [dot(accentColor)] [date text "yyyy/MM/dd (E)"] [divider] ──

@Composable
private fun TimelineDateHeader(
    dateStr: String,
    style: AppChatStyle
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Date marker dot
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(style.accentColor)
        )

        Spacer(modifier = Modifier.width(12.dp))

        Text(
            text = dateStr,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = style.dateHeaderColor
        )

        Spacer(modifier = Modifier.width(12.dp))

        // Horizontal divider
        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(style.timelineLineColor)
        )
    }
}

// ── Unread divider ──────────────────────────────────────────────────────────

@Composable
private fun UnreadDividerRow() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.4f))
        )

        Text(
            text = "읽지 않은 알림",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(horizontal = 12.dp)
        )

        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.4f))
        )
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

private fun formatDateKey(timestamp: Long): String {
    return SimpleDateFormat("yyyy/MM/dd (E)", Locale.getDefault())
        .format(Date(timestamp))
}

private fun formatChatDetailTime(timestamp: Long): String {
    return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(timestamp))
}
