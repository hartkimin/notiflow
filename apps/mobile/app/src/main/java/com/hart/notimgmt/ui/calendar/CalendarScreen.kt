package com.hart.notimgmt.ui.calendar

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.data.preferences.AppPreferences.Companion.UNCATEGORIZED_ID
import com.hart.notimgmt.ui.components.NotiFlowScreenWrapper
import com.hart.notimgmt.ui.theme.DEFAULT_CATEGORY_COLOR
import com.hart.notimgmt.viewmodel.CalendarViewModel
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

@Composable
fun CalendarScreen(
    onMessageClick: (String) -> Unit = {},
    viewModel: CalendarViewModel = hiltViewModel()
) {
    val currentMonth by viewModel.currentMonth.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val categories by viewModel.categories.collectAsState()
    val messageDaysRaw by viewModel.messageDaysInMonth.collectAsState()
    val messagesForDate by viewModel.messagesForSelectedDate.collectAsState()
    val statusCounts by viewModel.statusCountsForSelectedDate.collectAsState()
    val allStatusSteps by viewModel.allStatusSteps.collectAsState()
    val selectedCategoryIds by viewModel.selectedCategoryIds.collectAsState()
    val showCategoryFilter by viewModel.showCategoryFilter.collectAsState()

    val filterCount = selectedCategoryIds?.size ?: 0
    val isFiltered = selectedCategoryIds != null

    val categoryColors = remember(categories) {
        categories.associate { it.id to it.color }
    }

    val categoryNames = remember(categories) {
        categories.associate { it.id to it.name }
    }

    val messageDays = remember(messageDaysRaw, currentMonth) {
        val zone = ZoneId.systemDefault()
        val result = mutableMapOf<Int, MutableSet<String?>>()
        messageDaysRaw.forEach { dc ->
            val date = Instant.ofEpochMilli(dc.receivedAt)
                .atZone(zone)
                .toLocalDate()
            if (date.year == currentMonth.year && date.monthValue == currentMonth.monthValue) {
                result.getOrPut(date.dayOfMonth) { mutableSetOf() }.add(dc.categoryId)
            }
        }
        result.mapValues { it.value.toList() }
    }

    NotiFlowScreenWrapper(
        title = "캘린더",
        expandedHeight = if (showCategoryFilter) 100.dp else 56.dp,
        actions = {
            IconButton(onClick = { viewModel.toggleCategoryFilter() }) {
                Box {
                    Icon(
                        Icons.Default.FilterList,
                        contentDescription = "카테고리 필터",
                        tint = if (isFiltered) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (isFiltered) {
                        Surface(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .size(16.dp),
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.primary
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = "$filterCount",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.8f
                                )
                            }
                        }
                    }
                }
            }
        },
        expandedContent = {
            AnimatedVisibility(
                visible = showCategoryFilter,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "카테고리 필터",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (isFiltered) {
                            Surface(
                                onClick = { viewModel.selectAllCategories() },
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
                            ) {
                                Text(
                                    text = "전체 선택",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CalendarCategoryFilterChip(
                            label = "미분류",
                            color = null,
                            isSelected = viewModel.isCategorySelected(UNCATEGORIZED_ID),
                            onClick = { viewModel.toggleCategorySelection(UNCATEGORIZED_ID) }
                        )
                        categories.forEach { category ->
                            CalendarCategoryFilterChip(
                                label = category.name,
                                color = Color(category.color),
                                isSelected = viewModel.isCategorySelected(category.id),
                                onClick = { viewModel.toggleCategorySelection(category.id) }
                            )
                        }
                    }
                }
            }
        }
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize()
        ) {
            item {
                CalendarGrid(
                    yearMonth = currentMonth,
                    selectedDate = selectedDate,
                    messageDays = messageDays,
                    categoryColors = categoryColors,
                    onDateClick = { date -> viewModel.selectDate(date) },
                    onPreviousMonth = { viewModel.previousMonth() },
                    onNextMonth = { viewModel.nextMonth() }
                )
            }

        if (selectedDate != null) {
            item {
                HorizontalDivider(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                )

                // Date header with swipe gesture
                var dragAmount by remember { mutableFloatStateOf(0f) }
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .pointerInput(Unit) {
                            detectHorizontalDragGestures(
                                onDragEnd = {
                                    if (dragAmount > 100f) {
                                        viewModel.selectPreviousDate()
                                    } else if (dragAmount < -100f) {
                                        viewModel.selectNextDate()
                                    }
                                    dragAmount = 0f
                                },
                                onDragCancel = { dragAmount = 0f },
                                onHorizontalDrag = { _, delta ->
                                    dragAmount += delta
                                }
                            )
                        }
                        .padding(horizontal = 16.dp)
                ) {
                    Text(
                        text = selectedDate!!.format(DateTimeFormatter.ofPattern("yyyy년 M월 d일")),
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(vertical = 2.dp)
                    )

                    Text(
                        text = "메시지 ${messagesForDate.size}건",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 2.dp)
                    )
                }
            }

            item {
                StatusStatsBar(
                    statusCounts = statusCounts,
                    statusSteps = allStatusSteps
                )
            }

            if (messagesForDate.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "이 날짜에 메시지가 없습니다",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                itemsIndexed(
                    items = messagesForDate,
                    key = { _, msg -> msg.id }
                ) { index, message ->
                    val catName = message.categoryId?.let { categoryNames[it] } ?: ""
                    val catColor = message.categoryId?.let { categoryColors[it] } ?: DEFAULT_CATEGORY_COLOR
                    val statusStep = message.statusId?.let { sid ->
                        allStatusSteps.find { it.id == sid }
                    }
                    val isLast = index == messagesForDate.lastIndex

                    CalendarTimelineItem(
                        message = message,
                        categoryName = catName,
                        categoryColor = catColor,
                        statusName = statusStep?.name,
                        statusColor = statusStep?.color,
                        allStatusSteps = allStatusSteps,
                        isLast = isLast,
                        onClick = { onMessageClick(message.id) },
                        onStatusChange = { statusId ->
                            viewModel.updateMessageStatus(message.id, statusId)
                        }
                    )
                }
            }
        } else {
            item {
                HorizontalDivider(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "날짜를 선택하세요",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
    } // end NotiFlowScreenWrapper
}

// 캘린더 타임라인 메시지 아이템
@Composable
private fun CalendarTimelineItem(
    message: CapturedMessageEntity,
    categoryName: String,
    categoryColor: Int,
    statusName: String?,
    statusColor: Int?,
    allStatusSteps: List<StatusStepEntity>,
    isLast: Boolean,
    onClick: () -> Unit,
    onStatusChange: (String) -> Unit
) {
    val context = LocalContext.current
    val catColor = Color(categoryColor)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 16.dp)
    ) {
        // 타임라인 열 (앱 아이콘 + 시간 + 라인)
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.width(48.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // 앱 아이콘
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
                        .size(32.dp)
                        .clip(CircleShape)
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(catColor.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (message.source == "SMS")
                            Icons.Default.Sms else Icons.Default.Notifications,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = catColor
                    )
                }
            }

            // 시간 표시 (HH:mm)
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = formatTimeShort(message.receivedAt),
                style = MaterialTheme.typography.labelSmall,
                fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.85f,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1
            )

            // 연결선
            if (!isLast) {
                Spacer(modifier = Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .weight(1f)
                        .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                )
            }
        }

        // 메시지 카드
        Surface(
            modifier = Modifier
                .weight(1f)
                .padding(start = 8.dp, end = 16.dp, top = 4.dp, bottom = 4.dp)
                .clickable(onClick = onClick),
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        ) {
            Column(
                modifier = Modifier.padding(12.dp)
            ) {
                // 발신자 + 프로필 사진 + 카테고리
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // 발신자 프로필 사진
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
                                .size(20.dp)
                                .clip(CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                    }

                    Text(
                        text = message.sender.ifEmpty { message.appName },
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // 카테고리 태그
                    Text(
                        text = categoryName.ifEmpty { "미분류" },
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = if (categoryName.isEmpty())
                            MaterialTheme.colorScheme.onSurfaceVariant
                        else catColor,
                        modifier = Modifier
                            .background(
                                color = if (categoryName.isEmpty())
                                    MaterialTheme.colorScheme.surfaceVariant
                                else
                                    catColor.copy(alpha = 0.1f),
                                shape = RoundedCornerShape(12.dp)
                            )
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }

                // 앱 이름 + 시간
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (message.appName.isNotEmpty() && message.appName != message.sender) {
                        Text(
                            text = message.appName,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1
                        )
                        Text(
                            text = " · ",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Text(
                        text = formatTime(message.receivedAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                // 메시지 내용
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // 상태 뱃지
                if (statusName != null || allStatusSteps.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))

                    var showStatusMenu by remember { mutableStateOf(false) }
                    val chipColor = if (statusColor != null) Color(statusColor)
                    else MaterialTheme.colorScheme.onSurfaceVariant

                    Box {
                        Surface(
                            modifier = Modifier.clickable { showStatusMenu = true },
                            shape = RoundedCornerShape(6.dp),
                            color = chipColor.copy(alpha = 0.1f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(chipColor)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = statusName ?: "상태 없음",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = chipColor,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        DropdownMenu(
                            expanded = showStatusMenu,
                            onDismissRequest = { showStatusMenu = false }
                        ) {
                            allStatusSteps.forEach { step ->
                                val stepColor = Color(step.color)
                                val isCurrentStatus = message.statusId == step.id
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            text = step.name,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = if (isCurrentStatus) FontWeight.SemiBold else FontWeight.Normal,
                                            color = if (isCurrentStatus) stepColor else MaterialTheme.colorScheme.onSurface
                                        )
                                    },
                                    onClick = {
                                        onStatusChange(step.id)
                                        showStatusMenu = false
                                    },
                                    leadingIcon = {
                                        Box(
                                            modifier = Modifier
                                                .size(10.dp)
                                                .clip(CircleShape)
                                                .background(stepColor)
                                        )
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CalendarCategoryFilterChip(
    label: String,
    color: Color?,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val chipColor = color ?: MaterialTheme.colorScheme.onSurfaceVariant

    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        color = if (isSelected) chipColor.copy(alpha = 0.15f) else Color.Transparent,
        border = BorderStroke(
            1.dp,
            if (isSelected) chipColor else MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isSelected) Icons.Default.CheckCircle
                else Icons.Default.RadioButtonUnchecked,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = if (isSelected) chipColor else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = if (isSelected) chipColor else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun formatTime(timestamp: Long): String {
    val sdf = SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

private fun formatTimeShort(timestamp: Long): String {
    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}
