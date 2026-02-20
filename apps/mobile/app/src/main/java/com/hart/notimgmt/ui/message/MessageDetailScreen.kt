package com.hart.notimgmt.ui.message

import android.app.PendingIntent
import android.content.Intent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.AlarmOff
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import com.hart.notimgmt.ui.navigation.LocalSnackbarHostState
import com.hart.notimgmt.data.model.CommentItem
import com.hart.notimgmt.data.model.StatusChangeItem
import com.hart.notimgmt.data.model.parseComments
import com.hart.notimgmt.data.model.parseStatusHistory
import kotlinx.coroutines.launch
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.service.notification.DeepLinkCache
import com.hart.notimgmt.viewmodel.MessageViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessageDetailScreen(
    messageId: String,
    onBack: () -> Unit,
    viewModel: MessageViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val snackbarHostState = LocalSnackbarHostState.current
    val coroutineScope = rememberCoroutineScope()
    val categories by viewModel.categories.collectAsState()
    val allStatusSteps by viewModel.allStatusSteps.collectAsState()

    val messageFlow = remember(messageId) { viewModel.getMessageByIdFlow(messageId) }
    val currentMessage by messageFlow.collectAsState(initial = null)

    var showDeleteDialog by remember { mutableStateOf(false) }
    var showCategoryDialog by remember { mutableStateOf(false) }
    var showSnoozeSheet by remember { mutableStateOf(false) }
    var newCommentText by remember { mutableStateOf("") }
    var isEditingContent by remember { mutableStateOf(false) }
    var editingContentText by remember { mutableStateOf("") }
    var showOriginalDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        val messageToDelete = currentMessage
        if (messageToDelete != null) {
            com.hart.notimgmt.ui.components.ConfirmDialog(
                title = "메시지 삭제",
                message = "이 메시지를 삭제하시겠습니까?",
                onConfirm = {
                    viewModel.deleteMessage(messageToDelete)
                    showDeleteDialog = false
                    coroutineScope.launch {
                        snackbarHostState.showSnackbar("메시지가 삭제되었습니다")
                    }
                    onBack()
                },
                onDismiss = { showDeleteDialog = false }
            )
        }
    }

    if (showCategoryDialog) {
        CategorySelectDialog(
            categories = categories,
            currentCategoryId = currentMessage?.categoryId,
            onSelect = { categoryId ->
                viewModel.updateMessageCategory(messageId, categoryId)
                showCategoryDialog = false
                val categoryName = categories.find { it.id == categoryId }?.name ?: ""
                coroutineScope.launch {
                    snackbarHostState.showSnackbar("카테고리가 '${categoryName}'(으)로 변경되었습니다")
                }
            },
            onDismiss = { showCategoryDialog = false }
        )
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "알림 상세",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "뒤로"
                        )
                    }
                },
                actions = {
                    // 원본 앱 열기 (SMS 제외)
                    if (currentMessage != null && currentMessage?.source != "SMS") {
                        IconButton(onClick = {
                            val msg = currentMessage!!
                            // 3단계 딥링크 폴백 체인:
                            // 1) messageId 캐시 → 정확한 알림의 PendingIntent
                            // 2) source|sender 캐시 → 같은 발신자의 최신 PendingIntent
                            // 3) getLaunchIntentForPackage → 앱 메인 화면
                            val deepLink = DeepLinkCache.get(messageId)
                                ?: DeepLinkCache.getBySender(msg.source, msg.sender)
                            if (deepLink != null) {
                                try {
                                    deepLink.send()
                                } catch (e: PendingIntent.CanceledException) {
                                    val intent = context.packageManager
                                        .getLaunchIntentForPackage(msg.source)
                                    if (intent != null) {
                                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        context.startActivity(intent)
                                    } else {
                                        coroutineScope.launch {
                                            snackbarHostState.showSnackbar("앱을 찾을 수 없습니다")
                                        }
                                    }
                                }
                            } else {
                                val intent = context.packageManager
                                    .getLaunchIntentForPackage(msg.source)
                                if (intent != null) {
                                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    context.startActivity(intent)
                                } else {
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("앱을 찾을 수 없습니다")
                                    }
                                }
                            }
                        }) {
                            Icon(
                                Icons.AutoMirrored.Filled.OpenInNew,
                                contentDescription = "원본 앱 열기",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    // 핀 토글
                    IconButton(onClick = { viewModel.togglePin(messageId) }) {
                        Icon(
                            imageVector = Icons.Default.PushPin,
                            contentDescription = if (currentMessage?.isPinned == true) "고정 해제" else "고정",
                            tint = if (currentMessage?.isPinned == true) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    // 스누즈
                    IconButton(onClick = {
                        val msg = currentMessage
                        if (msg?.snoozeAt != null && msg.snoozeAt > System.currentTimeMillis()) {
                            viewModel.cancelSnooze(messageId)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("스누즈가 취소되었습니다")
                            }
                        } else {
                            showSnoozeSheet = true
                        }
                    }) {
                        val hasActiveSnooze = currentMessage?.snoozeAt != null &&
                            (currentMessage?.snoozeAt ?: 0L) > System.currentTimeMillis()
                        Icon(
                            imageVector = if (hasActiveSnooze) Icons.Default.AlarmOff else Icons.Default.Alarm,
                            contentDescription = if (hasActiveSnooze) "스누즈 취소" else "스누즈",
                            tint = if (hasActiveSnooze) Color(0xFFF59E0B)
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = { showDeleteDialog = true }) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "삭제",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { innerPadding ->
        if (currentMessage == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    "메시지를 찾을 수 없습니다",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            val message = currentMessage ?: return@Scaffold
            val category = message.categoryId?.let { catId ->
                categories.find { it.id == catId }
            }
            val stepsForCategory = allStatusSteps

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
            ) {
                // Header card
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(
                        0.5.dp,
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp)
                    ) {
                        // App info row (앱 아이콘 표시)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val catColor = if (category != null) Color(category.color)
                                else MaterialTheme.colorScheme.onSurfaceVariant

                            val appIconBitmap = remember(message.source) {
                                try {
                                    val drawable = context.packageManager.getApplicationIcon(message.source)
                                    val size = 64
                                    val bmp = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
                                    val canvas = android.graphics.Canvas(bmp)
                                    drawable.setBounds(0, 0, size, size)
                                    drawable.draw(canvas)
                                    bmp.asImageBitmap()
                                } catch (e: Exception) { null }
                            }

                            if (appIconBitmap != null) {
                                Image(
                                    bitmap = appIconBitmap,
                                    contentDescription = message.appName,
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                )
                            } else {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(catColor.copy(alpha = 0.12f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = if (message.source == "SMS")
                                            Icons.Default.Sms else Icons.Default.Notifications,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp),
                                        tint = catColor
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = message.appName,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Sender row (프로필 사진 + 발신자)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // 발신자 프로필 사진 (알림 large icon = 메신저 프로필)
                            val senderBitmap = remember(message.senderIcon) {
                                message.senderIcon?.let {
                                    try {
                                        val bytes = android.util.Base64.decode(it, android.util.Base64.NO_WRAP)
                                        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                                            ?.asImageBitmap()
                                    } catch (e: Exception) { null }
                                }
                            }

                            if (senderBitmap != null) {
                                Image(
                                    bitmap = senderBitmap,
                                    contentDescription = "프로필",
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(CircleShape)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                            }

                            Text(
                                text = message.sender,
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Category tag (clickable to change)
                        if (category != null) {
                            val catColor = Color(category.color)
                            Text(
                                text = "카테고리: ${category.name}",
                                style = MaterialTheme.typography.labelMedium,
                                color = catColor,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(
                                        color = catColor.copy(alpha = 0.1f),
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    .clickable { showCategoryDialog = true }
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        } else {
                            Text(
                                text = "카테고리: 미분류",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(
                                        color = MaterialTheme.colorScheme.surfaceVariant,
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    .clickable { showCategoryDialog = true }
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                // Content card
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(
                        0.5.dp,
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                    )
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        if (isEditingContent) {
                            // 편집 모드
                            OutlinedTextField(
                                value = editingContentText,
                                onValueChange = { editingContentText = it },
                                modifier = Modifier.fillMaxWidth(),
                                minLines = 3,
                                maxLines = 10,
                                shape = RoundedCornerShape(12.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                )
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                TextButton(onClick = { isEditingContent = false }) {
                                    Text("취소")
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                TextButton(
                                    onClick = {
                                        if (editingContentText.isNotBlank() && editingContentText != message.content) {
                                            viewModel.updateContent(message.id, editingContentText.trim())
                                            coroutineScope.launch {
                                                snackbarHostState.showSnackbar("본문이 수정되었습니다")
                                            }
                                        }
                                        isEditingContent = false
                                    },
                                    enabled = editingContentText.isNotBlank()
                                ) {
                                    Icon(
                                        Icons.Default.Check,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("저장")
                                }
                            }
                        } else {
                            // 읽기 모드 — 본문 + 편집 버튼
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Top
                            ) {
                                Text(
                                    text = message.content,
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    lineHeight = MaterialTheme.typography.bodyLarge.lineHeight,
                                    modifier = Modifier.weight(1f)
                                )
                                IconButton(
                                    onClick = {
                                        editingContentText = message.content
                                        isEditingContent = true
                                    },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Edit,
                                        contentDescription = "본문 수정",
                                        modifier = Modifier.size(18.dp),
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            
                            // 첨부 이미지
                            if (message.attachedImage != null) {
                                val attachedBitmap = remember(message.attachedImage) {
                                    try {
                                        val bytes = android.util.Base64.decode(message.attachedImage, android.util.Base64.NO_WRAP)
                                        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
                                    } catch (e: Exception) { null }
                                }
                                if (attachedBitmap != null) {
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Image(
                                        bitmap = attachedBitmap,
                                        contentDescription = "첨부 이미지",
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.FillWidth
                                    )
                                }
                            }

                            // 수정됨 표시 + 원문보기
                            if (message.originalContent != null) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = "수정됨",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontStyle = FontStyle.Italic,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    TextButton(
                                        onClick = { showOriginalDialog = true },
                                        modifier = Modifier.height(28.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.History,
                                            contentDescription = null,
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            "원문보기",
                                            style = MaterialTheme.typography.labelSmall
                                        )
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Timestamp
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.AccessTime,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "수신시간: ${formatFullTime(message.receivedAt)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                // Status section
                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "상태 업데이트",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                )

                if (stepsForCategory.isEmpty()) {
                    Text(
                        text = "설정된 상태 단계가 없습니다",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 20.dp)
                    )
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        stepsForCategory.forEach { step ->
                            val isSelected = message.statusId == step.id
                            val stepColor = Color(step.color)

                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        viewModel.updateMessageStatus(message.id, step.id)
                                    },
                                shape = RoundedCornerShape(12.dp),
                                color = if (isSelected) stepColor.copy(alpha = 0.15f)
                                else MaterialTheme.colorScheme.surfaceVariant,
                                border = if (isSelected)
                                    androidx.compose.foundation.BorderStroke(
                                        2.dp, stepColor
                                    )
                                else null
                            ) {
                                Column(
                                    modifier = Modifier.padding(
                                        horizontal = 12.dp,
                                        vertical = 10.dp
                                    ),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(CircleShape)
                                            .background(stepColor)
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = step.name,
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = if (isSelected) stepColor
                                        else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }

                // Status change history section
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "상태 변경 이력",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                )

                val statusHistoryItems = remember(message.statusHistory) {
                    parseStatusHistory(message.statusHistory).sortedByDescending { it.changedAt }
                }

                if (statusHistoryItems.isEmpty()) {
                    Text(
                        text = "아직 상태 변경 이력이 없습니다",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp)
                    )
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                    ) {
                        statusHistoryItems.forEachIndexed { index, item ->
                            val toStep = allStatusSteps.find { it.id == item.toStatusId }
                            val toColor = if (toStep != null) Color(toStep.color) else MaterialTheme.colorScheme.primary
                            StatusChangeTimelineItem(
                                item = item,
                                dotColor = toColor,
                                allStatusSteps = allStatusSteps,
                                isLast = index == statusHistoryItems.lastIndex
                            )
                        }
                    }
                }

                // Comment section
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "코멘트",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                )

                // Input area
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = newCommentText,
                        onValueChange = { newCommentText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = {
                            Text(
                                "코멘트를 입력하세요",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        },
                        minLines = 1,
                        maxLines = 3,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                        )
                    )
                    IconButton(
                        onClick = {
                            if (newCommentText.isNotBlank()) {
                                viewModel.addComment(message.id, newCommentText.trim())
                                newCommentText = ""
                            }
                        },
                        enabled = newCommentText.isNotBlank()
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = "추가",
                            tint = if (newCommentText.isNotBlank())
                                MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                    }
                }

                // Timeline list
                val comments = remember(message.comment) {
                    parseComments(message.comment).sortedByDescending { it.createdAt }
                }

                if (comments.isEmpty()) {
                    Text(
                        text = "아직 코멘트가 없습니다",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                    )
                } else {
                    Spacer(modifier = Modifier.height(12.dp))
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                    ) {
                        comments.forEachIndexed { index, comment ->
                            CommentTimelineItem(
                                comment = comment,
                                isLast = index == comments.lastIndex,
                                onDelete = {
                                    viewModel.deleteComment(message.id, comment.id)
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }

    // 원문보기 다이얼로그
    if (showOriginalDialog && currentMessage?.originalContent != null) {
        AlertDialog(
            onDismissRequest = { showOriginalDialog = false },
            title = { Text("원문", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ) {
                        Text(
                            text = currentMessage?.originalContent ?: "",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showOriginalDialog = false }) {
                    Text("닫기")
                }
            }
        )
    }

    // 스누즈 바텀시트
    if (showSnoozeSheet) {
        com.hart.notimgmt.ui.components.SnoozeBottomSheet(
            onDismiss = { showSnoozeSheet = false },
            onSnoozeSelected = { snoozeAtMillis ->
                viewModel.snoozeMessage(messageId, snoozeAtMillis)
                showSnoozeSheet = false
                coroutineScope.launch {
                    snackbarHostState.showSnackbar("스누즈가 설정되었습니다")
                }
            }
        )
    }
}

@Composable
private fun CommentTimelineItem(
    comment: CommentItem,
    isLast: Boolean,
    onDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
    ) {
        // Timeline line + dot
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.width(24.dp).fillMaxHeight()
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary)
            )
            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .weight(1f)
                        .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Content
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(bottom = if (isLast) 0.dp else 16.dp)
        ) {
            // Time
            Text(
                text = formatCommentTime(comment.createdAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(2.dp))
            // Comment content
            Text(
                text = comment.content,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        // Delete button
        IconButton(
            onClick = onDelete,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = "삭제",
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
            )
        }
    }
}

@Composable
private fun StatusChangeTimelineItem(
    item: StatusChangeItem,
    dotColor: Color,
    allStatusSteps: List<com.hart.notimgmt.data.db.entity.StatusStepEntity>,
    isLast: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
    ) {
        // Timeline line + dot
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.width(24.dp).fillMaxHeight()
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .weight(1f)
                        .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Content
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(bottom = if (isLast) 0.dp else 16.dp)
        ) {
            // Time
            Text(
                text = formatCommentTime(item.changedAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(4.dp))
            // From → To chips
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // From chip
                val fromStep = allStatusSteps.find { it.id == item.fromStatusId }
                val fromColor = if (fromStep != null) Color(fromStep.color) else MaterialTheme.colorScheme.onSurfaceVariant
                val fromName = item.fromStatusName ?: "없음"
                StatusChip(name = fromName, color = fromColor)

                Text(
                    text = "\u2192",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // To chip
                val toStep = allStatusSteps.find { it.id == item.toStatusId }
                val toColor = if (toStep != null) Color(toStep.color) else MaterialTheme.colorScheme.primary
                StatusChip(name = item.toStatusName, color = toColor)
            }
        }
    }
}

@Composable
private fun StatusChip(name: String, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .background(
                color = color.copy(alpha = 0.12f),
                shape = RoundedCornerShape(6.dp)
            )
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Box(
            modifier = Modifier
                .size(5.dp)
                .clip(CircleShape)
                .background(color)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = name,
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}

private fun formatFullTime(timestamp: Long): String {
    val format = java.text.SimpleDateFormat("yyyy년 M월 d일 a h:mm", java.util.Locale.KOREAN)
    return format.format(java.util.Date(timestamp))
}

private fun formatCommentTime(timestamp: Long): String {
    if (timestamp == 0L) return ""
    val format = java.text.SimpleDateFormat("yyyy/MM/dd HH:mm", java.util.Locale.KOREAN)
    return format.format(java.util.Date(timestamp))
}
