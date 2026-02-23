package com.hart.notimgmt.ui.dashboard

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SelectAll
import androidx.compose.material.icons.outlined.Apps
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.ui.components.HighlightedText
import com.hart.notimgmt.ui.components.NotiFlowScreenWrapper
import com.hart.notimgmt.viewmodel.AppInfo
import com.hart.notimgmt.viewmodel.ChatRoomItem
import com.hart.notimgmt.viewmodel.DashboardViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DashboardScreen(
    onNavigateToChat: (source: String, sender: String) -> Unit,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val chatRooms by viewModel.chatRooms.collectAsState()
    val availableApps by viewModel.availableApps.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val selectedApp by viewModel.selectedApp.collectAsState()

    var isSearchVisible by rememberSaveable { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    // 선택 모드 상태
    var isSelectionMode by rememberSaveable { mutableStateOf(false) }
    var selectedRoomKeys by remember { mutableStateOf(setOf<String>()) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    // 선택 모드 해제 시 선택 초기화
    fun exitSelectionMode() {
        isSelectionMode = false
        selectedRoomKeys = emptySet()
    }

    fun roomKey(room: ChatRoomItem) = "${room.source}_${room.roomId}"

    // expandedHeight: statusBar + title(56dp) + icon chips(~68dp)
    val expandedHeight = when {
        availableApps.isNotEmpty() -> 160.dp
        else -> 80.dp
    }

    // 선택된 대화방 일괄 삭제 확인 다이얼로그
    if (showDeleteDialog && selectedRoomKeys.isNotEmpty()) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("대화방 삭제") },
            text = { Text("선택한 ${selectedRoomKeys.size}개 대화방의 모든 메시지를 삭제하시겠습니까?\n삭제된 메시지는 휴지통에서 복원할 수 있습니다.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        val roomsToDelete = chatRooms
                            .filter { selectedRoomKeys.contains(roomKey(it)) }
                            .map { Pair(it.source, it.roomId) }
                        viewModel.deleteRooms(roomsToDelete)
                        showDeleteDialog = false
                        exitSelectionMode()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) { Text("삭제") }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text("취소") }
            }
        )
    }

    NotiFlowScreenWrapper(
        title = "NotiFlow",
        expandedHeight = expandedHeight,
        actions = {
            IconButton(onClick = {
                isSearchVisible = !isSearchVisible
                if (!isSearchVisible) {
                    viewModel.updateSearchQuery("")
                }
            }) {
                Icon(
                    imageVector = if (isSearchVisible) Icons.Default.Close else Icons.Default.Search,
                    contentDescription = if (isSearchVisible) "검색 닫기" else "검색",
                    tint = MaterialTheme.colorScheme.onBackground
                )
            }
        },
        expandedContent = {
            // 앱 필터 칩 (헤더 확장 영역 — 스크롤 시 접힘)
            if (availableApps.isNotEmpty()) {
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        AppIconChip(
                            icon = {
                                Icon(
                                    Icons.Outlined.Apps,
                                    contentDescription = null,
                                    modifier = Modifier.size(22.dp),
                                    tint = if (selectedApp == null)
                                        MaterialTheme.colorScheme.onPrimary
                                    else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            },
                            label = "전체",
                            selected = selectedApp == null,
                            onClick = { viewModel.selectApp(null) }
                        )
                    }
                    items(
                        items = availableApps,
                        key = { it.packageName }
                    ) { app ->
                        AppFilterChip(
                            app = app,
                            selected = selectedApp == app.packageName,
                            onClick = { viewModel.selectApp(app.packageName) }
                        )
                    }
                }
            }
        }
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // 선택 모드 바
            AnimatedVisibility(
                visible = isSelectionMode,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                RoomSelectionModeBar(
                    selectedCount = selectedRoomKeys.size,
                    totalCount = chatRooms.size,
                    onSelectAll = {
                        selectedRoomKeys = if (selectedRoomKeys.size == chatRooms.size) {
                            emptySet()
                        } else {
                            chatRooms.map { roomKey(it) }.toSet()
                        }
                    },
                    onDelete = { showDeleteDialog = true },
                    onCancel = { exitSelectionMode() }
                )
            }

            // 검색바 (콘텐츠 영역 상단에 배치 — 겹침 없음)
            AnimatedVisibility(
                visible = isSearchVisible && !isSelectionMode,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = viewModel::updateSearchQuery,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .focusRequester(focusRequester),
                    placeholder = { Text("대화방 또는 메시지 검색") },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = "Search")
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.updateSearchQuery("") }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear search")
                            }
                        }
                    },
                    shape = RoundedCornerShape(percent = 50),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant,
                    )
                )
            }

            // 검색바 표시 시 자동 포커스
            LaunchedEffect(isSearchVisible) {
                if (isSearchVisible) {
                    focusRequester.requestFocus()
                }
            }

            // 채팅룸 목록
            if (chatRooms.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (searchQuery.isNotBlank()) {
                            "'${searchQuery}'에 대한 검색 결과가 없습니다."
                        } else {
                            "메시지가 없습니다."
                        },
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentPadding = PaddingValues(bottom = 80.dp)
                ) {
                    items(
                        items = chatRooms,
                        key = { "${it.source}_${it.roomId}" }
                    ) { room ->
                        val key = roomKey(room)
                        ChatRoomListItem(
                            item = room,
                            onClick = {
                                if (isSelectionMode) {
                                    selectedRoomKeys = if (selectedRoomKeys.contains(key)) {
                                        val newSet = selectedRoomKeys - key
                                        if (newSet.isEmpty()) {
                                            isSelectionMode = false
                                        }
                                        newSet
                                    } else {
                                        selectedRoomKeys + key
                                    }
                                } else {
                                    onNavigateToChat(room.source, room.roomId)
                                }
                            },
                            onLongClick = {
                                if (!isSelectionMode) {
                                    isSelectionMode = true
                                    selectedRoomKeys = setOf(key)
                                }
                            },
                            searchQuery = searchQuery,
                            isSelectionMode = isSelectionMode,
                            isSelected = selectedRoomKeys.contains(key)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AppFilterChip(
    app: AppInfo,
    selected: Boolean,
    onClick: () -> Unit
) {
    val context = LocalContext.current
    val iconBitmap by produceState<ImageBitmap?>(initialValue = null, key1 = app.packageName) {
        value = withContext(Dispatchers.IO) {
            try {
                val drawable = context.packageManager.getApplicationIcon(app.packageName)
                val size = 64
                val bmp = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
                val canvas = android.graphics.Canvas(bmp)
                drawable.setBounds(0, 0, size, size)
                drawable.draw(canvas)
                bmp.asImageBitmap()
            } catch (_: Exception) { null }
        }
    }

    AppIconChip(
        icon = {
            if (iconBitmap != null) {
                Image(
                    bitmap = iconBitmap!!,
                    contentDescription = app.appName,
                    modifier = Modifier.size(28.dp).clip(CircleShape)
                )
            } else {
                Text(
                    text = app.appName.take(1).uppercase(),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (selected)
                        MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        label = app.appName,
        selected = selected,
        onClick = onClick
    )
}

/** Icon-centric chip: circular icon + small label underneath. */
@Composable
private fun AppIconChip(
    icon: @Composable () -> Unit,
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    val bgColor = if (selected) MaterialTheme.colorScheme.primary
                  else MaterialTheme.colorScheme.surfaceVariant
    val borderColor = if (selected) MaterialTheme.colorScheme.primary
                      else Color.Transparent
    val labelColor = if (selected) MaterialTheme.colorScheme.primary
                     else MaterialTheme.colorScheme.onSurfaceVariant

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(52.dp)
            .clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .border(
                    width = if (selected) 2.dp else 1.dp,
                    color = borderColor,
                    shape = CircleShape
                )
                .background(bgColor, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            icon()
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = labelColor,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun RoomSelectionModeBar(
    selectedCount: Int,
    totalCount: Int,
    onSelectAll: () -> Unit,
    onDelete: () -> Unit,
    onCancel: () -> Unit
) {
    val isAllSelected = selectedCount == totalCount && totalCount > 0

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.primaryContainer)
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onCancel, modifier = Modifier.size(40.dp)) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "취소",
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Text(
                text = "${selectedCount}개 선택",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(
                onClick = onSelectAll,
                shape = RoundedCornerShape(8.dp),
                color = if (isAllSelected)
                    MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f)
                else Color.Transparent
            ) {
                Icon(
                    Icons.Default.SelectAll,
                    contentDescription = if (isAllSelected) "선택 해제" else "전체 선택",
                    modifier = Modifier.padding(8.dp).size(22.dp),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Surface(
                onClick = onDelete,
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(start = 4.dp)
            ) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "삭제",
                    modifier = Modifier.padding(8.dp).size(22.dp),
                    tint = MaterialTheme.colorScheme.onError
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChatRoomListItem(
    item: ChatRoomItem,
    onClick: () -> Unit,
    onLongClick: () -> Unit = {},
    searchQuery: String = "",
    isSelectionMode: Boolean = false,
    isSelected: Boolean = false
) {
    val bgColor = if (isSelected)
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
    else Color.Transparent

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(bgColor)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            )
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 선택 모드 체크박스
        if (isSelectionMode) {
            Checkbox(
                checked = isSelected,
                onCheckedChange = null,
                modifier = Modifier.padding(end = 8.dp),
                colors = CheckboxDefaults.colors(
                    checkedColor = MaterialTheme.colorScheme.primary,
                    uncheckedColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )
        }

        // App or Sender Icon
        val iconBitmap = remember(item.senderIcon) {
            try {
                item.senderIcon?.let {
                    val bytes = android.util.Base64.decode(it, android.util.Base64.NO_WRAP)
                    android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
                }
            } catch (e: Exception) { null }
        }

        if (iconBitmap != null) {
            Image(
                bitmap = iconBitmap,
                contentDescription = item.displayTitle,
                modifier = Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )
        } else {
            Box(
                modifier = Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = item.displayTitle.take(1).uppercase(),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                HighlightedText(
                    text = item.displayTitle.ifEmpty { item.appName },
                    query = searchQuery,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = formatChatTime(item.lastReceivedAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                HighlightedText(
                    text = item.lastMessage,
                    query = searchQuery,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (item.matchCount > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "${item.matchCount}건 일치",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Medium
                    )
                }

                if (item.unreadCount > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .background(
                                color = MaterialTheme.colorScheme.error,
                                shape = RoundedCornerShape(percent = 50)
                            )
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (item.unreadCount > 99) "99+" else item.unreadCount.toString(),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onError,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

private fun formatChatTime(timestamp: Long): String {
    val today = java.util.Calendar.getInstance()
    val msgDate = java.util.Calendar.getInstance().apply { timeInMillis = timestamp }

    val isToday = today.get(java.util.Calendar.YEAR) == msgDate.get(java.util.Calendar.YEAR) &&
        today.get(java.util.Calendar.DAY_OF_YEAR) == msgDate.get(java.util.Calendar.DAY_OF_YEAR)
    val isSameYear = today.get(java.util.Calendar.YEAR) == msgDate.get(java.util.Calendar.YEAR)

    return when {
        isToday -> SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(timestamp))
        isSameYear -> SimpleDateFormat("M/d HH:mm", Locale.getDefault()).format(Date(timestamp))
        else -> SimpleDateFormat("yy/M/d HH:mm", Locale.getDefault()).format(Date(timestamp))
    }
}
