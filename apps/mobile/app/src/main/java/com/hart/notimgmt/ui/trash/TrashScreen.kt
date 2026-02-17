package com.hart.notimgmt.ui.trash

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material.icons.filled.SelectAll
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.ui.components.ConfirmDialog
import com.hart.notimgmt.ui.components.EmptyState
import com.hart.notimgmt.ui.navigation.LocalSnackbarHostState
import com.hart.notimgmt.viewmodel.MessageViewModel
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrashScreen(
    onMessageClick: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: MessageViewModel = hiltViewModel()
) {
    val deletedMessages by viewModel.deletedMessages.collectAsState()
    val selectionMode by viewModel.selectionMode.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()
    val snackbarHostState = LocalSnackbarHostState.current
    val coroutineScope = rememberCoroutineScope()

    var showEmptyTrashDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    // 화면 진입 시 선택 모드 초기화
    DisposableEffect(Unit) {
        viewModel.exitSelectionMode()
        onDispose { viewModel.exitSelectionMode() }
    }

    // 휴지통 비우기 확인
    if (showEmptyTrashDialog) {
        ConfirmDialog(
            title = "휴지통 비우기",
            message = "${deletedMessages.size}개의 메시지가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
            confirmText = "비우기",
            onConfirm = {
                viewModel.emptyTrash()
                showEmptyTrashDialog = false
                coroutineScope.launch {
                    snackbarHostState.showSnackbar("휴지통을 비웠습니다")
                }
            },
            onDismiss = { showEmptyTrashDialog = false }
        )
    }

    // 선택 항목 영구 삭제 확인
    if (showDeleteDialog) {
        ConfirmDialog(
            title = "영구 삭제",
            message = "${selectedIds.size}개의 메시지를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
            confirmText = "삭제",
            onConfirm = {
                val count = selectedIds.size
                viewModel.bulkPermanentDelete()
                showDeleteDialog = false
                coroutineScope.launch {
                    snackbarHostState.showSnackbar("${count}개 메시지가 영구 삭제되었습니다")
                }
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
        if (selectionMode) {
            // 선택 모드 액션바
            TrashSelectionBar(
                selectedCount = selectedIds.size,
                totalCount = deletedMessages.size,
                onSelectAll = { viewModel.selectAll(deletedMessages.map { it.id }) },
                onRestore = {
                    val count = selectedIds.size
                    viewModel.bulkRestore()
                    coroutineScope.launch {
                        snackbarHostState.showSnackbar("${count}개 메시지가 복원되었습니다")
                    }
                },
                onDelete = { showDeleteDialog = true },
                onCancel = { viewModel.exitSelectionMode() }
            )
        } else {
            // 일반 앱바
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                    }
                },
                title = {
                    Text(
                        "휴지통 (${deletedMessages.size})",
                        style = MaterialTheme.typography.headlineSmall
                    )
                },
                actions = {
                    if (deletedMessages.isNotEmpty()) {
                        Button(
                            onClick = { showEmptyTrashDialog = true },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.error
                            ),
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Icon(
                                Icons.Default.DeleteForever,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("비우기")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }

        if (deletedMessages.isEmpty()) {
            EmptyState(
                icon = Icons.Default.DeleteOutline,
                title = "휴지통이 비어있습니다",
                description = "삭제된 메시지가 여기에 표시됩니다"
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)
            ) {
                items(
                    items = deletedMessages,
                    key = { it.id }
                ) { message ->
                    TrashMessageItem(
                        message = message,
                        selectionMode = selectionMode,
                        isSelected = selectedIds.contains(message.id),
                        onClick = {
                            if (selectionMode) {
                                viewModel.toggleSelection(message.id)
                            } else {
                                onMessageClick(message.id)
                            }
                        },
                        onLongClick = {
                            if (!selectionMode) {
                                viewModel.enterSelectionMode(message.id)
                            }
                        },
                        onRestore = {
                            viewModel.restoreMessage(message.id)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("메시지가 복원되었습니다")
                            }
                        },
                        onPermanentDelete = {
                            viewModel.permanentDeleteMessage(message.id)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("메시지가 영구 삭제되었습니다")
                            }
                        }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TrashMessageItem(
    message: CapturedMessageEntity,
    selectionMode: Boolean,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onRestore: () -> Unit,
    onPermanentDelete: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected)
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        else MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            0.5.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 선택 모드: 체크 아이콘
            if (selectionMode) {
                Icon(
                    imageVector = if (isSelected) Icons.Default.CheckCircle
                    else Icons.Default.RadioButtonUnchecked,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = if (isSelected) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(12.dp))
            }

            // 앱 아이콘
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (message.source == "SMS") Icons.Default.Sms
                    else Icons.Default.Notifications,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // 메시지 내용
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = message.sender,
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = message.appName,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "삭제됨 · ${formatDeletedTime(message.updatedAt)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }

            // 개별 액션 버튼 (비선택 모드)
            if (!selectionMode) {
                Spacer(modifier = Modifier.width(4.dp))
                IconButton(
                    onClick = onRestore,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        Icons.Default.RestoreFromTrash,
                        contentDescription = "복원",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                }
                IconButton(
                    onClick = onPermanentDelete,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        Icons.Default.DeleteForever,
                        contentDescription = "영구 삭제",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun TrashSelectionBar(
    selectedCount: Int,
    totalCount: Int,
    onSelectAll: () -> Unit,
    onRestore: () -> Unit,
    onDelete: () -> Unit,
    onCancel: () -> Unit
) {
    val isAllSelected = selectedCount == totalCount && totalCount > 0

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.primaryContainer)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onCancel) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "취소",
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Text(
                text = "${selectedCount}개 선택됨",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
        Row {
            Button(
                onClick = onSelectAll,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isAllSelected)
                        MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f)
                    else MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.1f)
                )
            ) {
                Icon(
                    Icons.Default.SelectAll,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    if (isAllSelected) "선택됨" else "전체",
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Spacer(modifier = Modifier.width(4.dp))
            Button(
                onClick = onRestore,
                enabled = selectedCount > 0,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Icon(
                    Icons.Default.RestoreFromTrash,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("복원")
            }
            Spacer(modifier = Modifier.width(4.dp))
            Button(
                onClick = onDelete,
                enabled = selectedCount > 0,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Icon(
                    Icons.Default.DeleteForever,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("삭제")
            }
        }
    }
}

private fun formatDeletedTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    val minutes = diff / (1000 * 60)
    val hours = minutes / 60
    val days = hours / 24

    return when {
        minutes < 1 -> "방금 전"
        minutes < 60 -> "${minutes}분 전"
        hours < 24 -> "${hours}시간 전"
        days < 7 -> "${days}일 전"
        else -> {
            val sdf = SimpleDateFormat("yyyy/MM/dd", Locale.getDefault())
            sdf.format(Date(timestamp))
        }
    }
}
