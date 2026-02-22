package com.hart.notimgmt.ui.kanban

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.data.preferences.AppPreferences.Companion.UNCATEGORIZED_ID
import com.hart.notimgmt.ui.components.NotiFlowScreenWrapper
import com.hart.notimgmt.ui.theme.NotiFlowDesign
import com.hart.notimgmt.viewmodel.KanbanViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun KanbanScreen(
    viewModel: KanbanViewModel = hiltViewModel(),
    onMessageClick: (String) -> Unit = {}
) {
    val steps by viewModel.steps.collectAsState()
    val messagesByStatus by viewModel.messagesByStatus.collectAsState()
    val categories by viewModel.categories.collectAsState()
    val selectedCategoryIds by viewModel.selectedCategoryIds.collectAsState()
    val showCategoryFilter by viewModel.showCategoryFilter.collectAsState()

    // 선택된 카테고리 개수 표시용
    val filterCount = selectedCategoryIds?.size ?: 0
    val isFiltered = selectedCategoryIds != null

    // 검색 상태
    var searchQuery by remember { mutableStateOf("") }
    var isSearchExpanded by remember { mutableStateOf(false) }

    // 검색 필터링
    val filteredMessagesByStatus by remember(messagesByStatus, searchQuery) {
        derivedStateOf {
            if (searchQuery.isBlank()) messagesByStatus
            else messagesByStatus.mapValues { (_, messages) ->
                messages.filter {
                    it.content.contains(searchQuery, ignoreCase = true) ||
                        it.sender.contains(searchQuery, ignoreCase = true) ||
                        it.appName.contains(searchQuery, ignoreCase = true)
                }
            }
        }
    }

    // 스크롤 방향에 따라 검색바 표시/숨김
    val searchScrollConnection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (available.y < -5f && searchQuery.isBlank()) {
                    isSearchExpanded = false
                }
                return Offset.Zero
            }

            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: NestedScrollSource
            ): Offset {
                if (available.y > 10f) {
                    isSearchExpanded = true
                }
                return Offset.Zero
            }
        }
    }

    NotiFlowScreenWrapper(
        title = "보드",
        expandedHeight = if (showCategoryFilter) 100.dp else 56.dp,
        actions = {
            // 검색 아이콘
            IconButton(onClick = { isSearchExpanded = !isSearchExpanded }) {
                Icon(
                    Icons.Default.Search,
                    contentDescription = "검색",
                    tint = if (isSearchExpanded || searchQuery.isNotBlank())
                        MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            // 필터 아이콘
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
                                    color = MaterialTheme.colorScheme.onPrimary
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
                        CategoryFilterChip(
                            label = "미분류",
                            color = null,
                            isSelected = viewModel.isCategorySelected(UNCATEGORIZED_ID),
                            onClick = { viewModel.toggleCategorySelection(UNCATEGORIZED_ID) }
                        )
                        categories.forEach { category ->
                            CategoryFilterChip(
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .nestedScroll(searchScrollConnection)
        ) {
            // 검색바 (스와이프 또는 아이콘으로 표시)
            AnimatedVisibility(
                visible = isSearchExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                KanbanSearchBar(
                    query = searchQuery,
                    onQueryChange = { searchQuery = it }
                )
            }

            if (steps.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "상태 단계가 없습니다\n설정 탭에서 상태를 추가해주세요",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                // Kanban columns
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    steps.forEach { step ->
                        val columnMessages = filteredMessagesByStatus[step.id] ?: emptyList()
                        KanbanColumn(
                            title = step.name,
                            color = Color(step.color),
                            messages = columnMessages,
                            categories = categories,
                            steps = steps,
                            currentStepId = step.id,
                            onStatusChange = { messageId, statusId ->
                                viewModel.updateMessageStatus(messageId, statusId)
                            },
                            onMessageClick = onMessageClick
                        )
                    }
                }
            }
        }
    }
}

/**
 * 칸반 검색바 — 글래스 스타일
 */
@Composable
private fun KanbanSearchBar(
    query: String,
    onQueryChange: (String) -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .height(40.dp),
        shape = RoundedCornerShape(12.dp),
        color = glassColors.surfaceLight,
        border = BorderStroke(0.5.dp, glassColors.border.copy(alpha = 0.3f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Search,
                contentDescription = "검색",
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(8.dp))
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                modifier = Modifier.weight(1f),
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyMedium.copy(
                    color = MaterialTheme.colorScheme.onSurface
                ),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                decorationBox = { innerTextField ->
                    Box {
                        if (query.isEmpty()) {
                            Text(
                                text = "발신자, 내용 검색...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                            )
                        }
                        innerTextField()
                    }
                }
            )
            if (query.isNotEmpty()) {
                IconButton(
                    onClick = { onQueryChange("") },
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "지우기",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryFilterChip(
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

@Composable
private fun KanbanColumn(
    title: String,
    color: Color,
    messages: List<CapturedMessageEntity>,
    categories: List<CategoryEntity>,
    steps: List<StatusStepEntity>,
    currentStepId: String? = null,
    onStatusChange: (String, String) -> Unit,
    onMessageClick: (String) -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors

    Surface(
        modifier = Modifier
            .width(280.dp)
            .fillMaxHeight(),
        color = glassColors.surface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, glassColors.border)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Column header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(color)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = "${messages.size}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            if (messages.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "메시지 없음",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                val grouped = remember(messages) {
                    messages.groupBy { getDateKey(it.receivedAt) }
                        .toSortedMap(compareByDescending { it })
                }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    val groupEntries = grouped.entries.toList()
                    groupEntries.forEachIndexed { groupIdx, (dateKey, msgs) ->
                        item(key = "header_${currentStepId}_$dateKey") {
                            CompactDateHeader(dateKey)
                        }
                        val isLastGroup = groupIdx == groupEntries.size - 1
                        itemsIndexed(msgs, key = { _, m -> m.id }) { idx, message ->
                            val isLast = isLastGroup && idx == msgs.lastIndex
                            KanbanTimelineItem(
                                message = message,
                                categories = categories,
                                isLast = isLast,
                                steps = steps,
                                currentStepId = currentStepId,
                                onStatusChange = onStatusChange,
                                onMessageClick = onMessageClick
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CompactDateHeader(dateKey: String) {
    val displayDate = formatDateHeader(dateKey)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 4.dp, end = 4.dp, top = 12.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary)
        )

        Spacer(modifier = Modifier.width(8.dp))

        Text(
            text = displayDate,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.width(8.dp))

        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        )
    }
}

@Composable
private fun KanbanTimelineItem(
    message: CapturedMessageEntity,
    categories: List<CategoryEntity>,
    isLast: Boolean,
    steps: List<StatusStepEntity>,
    currentStepId: String?,
    onStatusChange: (String, String) -> Unit,
    onMessageClick: (String) -> Unit
) {
    val context = LocalContext.current
    val category = message.categoryId?.let { catId -> categories.find { it.id == catId } }
    val catColor = category?.let { Color(it.color) } ?: MaterialTheme.colorScheme.primary

    Row(modifier = Modifier.fillMaxWidth()) {
        // 미니 타임라인 (36dp)
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.width(36.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // 앱 아이콘
            val appIconBitmap = remember(message.source) {
                try {
                    val drawable = context.packageManager.getApplicationIcon(message.source)
                    val size = 48
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
                        .size(24.dp)
                        .clip(CircleShape)
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(catColor.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (message.source == "SMS")
                            Icons.Default.Sms else Icons.Default.Notifications,
                        contentDescription = null,
                        modifier = Modifier.size(12.dp),
                        tint = catColor
                    )
                }
            }

            Spacer(modifier = Modifier.height(1.dp))
            Text(
                text = formatTimeShort(message.receivedAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1
            )

            if (!isLast) {
                Spacer(modifier = Modifier.height(1.dp))
                Box(
                    modifier = Modifier
                        .width(1.5.dp)
                        .weight(1f)
                        .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                )
            }
        }

        // 카드 영역
        Box(modifier = Modifier.weight(1f)) {
            KanbanMessageCard(
                message = message,
                category = category,
                steps = steps,
                currentStepId = currentStepId,
                onStatusChange = onStatusChange,
                onClick = { onMessageClick(message.id) }
            )
        }
    }
}

@Composable
private fun KanbanMessageCard(
    message: CapturedMessageEntity,
    category: CategoryEntity?,
    steps: List<StatusStepEntity>,
    currentStepId: String?,
    onStatusChange: (String, String) -> Unit,
    onClick: () -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors
    val currentIndex = steps.indexOfFirst { it.id == currentStepId }
    val currentStep = steps.find { it.id == currentStepId }
    val nextStep = if (currentIndex >= 0 && currentIndex < steps.lastIndex) {
        steps[currentIndex + 1]
    } else if (currentStepId == null && steps.isNotEmpty()) {
        steps.first()
    } else {
        null
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(end = 4.dp, top = 3.dp, bottom = 3.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        color = glassColors.surfaceLight,
        border = BorderStroke(1.dp, glassColors.border)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            // 1행: 프로필사진 + 발신자 + 카테고리태그
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
                            .size(16.dp)
                            .clip(CircleShape)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                }

                Text(
                    text = message.sender.ifEmpty { message.appName },
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )

                Spacer(modifier = Modifier.width(6.dp))

                // 카테고리 태그
                if (category != null) {
                    val catColor = Color(category.color)
                    Text(
                        text = category.name,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = catColor,
                        modifier = Modifier
                            .background(
                                color = catColor.copy(alpha = 0.1f),
                                shape = RoundedCornerShape(12.dp)
                            )
                            .padding(horizontal = 6.dp, vertical = 1.dp)
                    )
                }
            }

            // 2행: 앱이름 (sender != appName일 때만)
            if (message.appName.isNotEmpty() && message.appName != message.sender) {
                Text(
                    text = message.appName,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // 3행: 메시지 내용
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            // 4행: 현재상태칩 + 이동버튼
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // 현재 상태 칩
                if (currentStep != null) {
                    val stepColor = Color(currentStep.color)
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = stepColor.copy(alpha = 0.1f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(5.dp)
                                    .clip(CircleShape)
                                    .background(stepColor)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = currentStep.name,
                                style = MaterialTheme.typography.labelSmall,
                                color = stepColor,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                // 이동 버튼
                if (nextStep != null) {
                    val nextColor = Color(nextStep.color)
                    Surface(
                        modifier = Modifier.clickable {
                            onStatusChange(message.id, nextStep.id)
                        },
                        shape = RoundedCornerShape(6.dp),
                        color = nextColor.copy(alpha = 0.1f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "이동",
                                style = MaterialTheme.typography.labelSmall,
                                color = nextColor,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Icon(
                                Icons.Default.ChevronRight,
                                contentDescription = null,
                                modifier = Modifier.size(12.dp),
                                tint = nextColor
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun getDateKey(timestamp: Long): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

private fun formatDateHeader(dateKey: String): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val date = sdf.parse(dateKey) ?: return dateKey
    val displayFormat = SimpleDateFormat("yyyy/MM/dd (E)", Locale.KOREAN)
    return displayFormat.format(date)
}

private fun formatTimeShort(timestamp: Long): String {
    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}
