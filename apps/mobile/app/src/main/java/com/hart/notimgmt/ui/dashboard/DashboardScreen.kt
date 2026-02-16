package com.hart.notimgmt.ui.dashboard

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.ui.components.NotiFlowScreenWrapper
import com.hart.notimgmt.ui.theme.TwsTheme
import com.hart.notimgmt.viewmodel.CategorySummary
import com.hart.notimgmt.viewmodel.DashboardViewModel
import com.hart.notimgmt.viewmodel.UrgencyLevel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DashboardScreen(
    onMessageClick: (String) -> Unit,
    onNavigateToMessages: (statusFilter: String?, completedToday: Boolean) -> Unit,
    onNavigateToCategoryMessages: (categoryId: String?) -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val todayCount by viewModel.todayCount.collectAsState()
    val todayDelta by viewModel.todayDelta.collectAsState()
    val pendingCount by viewModel.pendingCount.collectAsState()
    val urgentCount by viewModel.urgentCount.collectAsState()
    val completedTodayCount by viewModel.completedTodayCount.collectAsState()
    val completionRate by viewModel.completionRate.collectAsState()
    val pendingMessages by viewModel.pendingMessages.collectAsState()
    val completedTodayMessages by viewModel.completedTodayMessages.collectAsState()
    val categorySummaries by viewModel.categorySummaries.collectAsState()
    val categories by viewModel.categories.collectAsState()
    val statusSteps by viewModel.statusSteps.collectAsState()

    var searchQuery by remember { mutableStateOf("") }

    // 검색 필터링 (클라이언트 사이드)
    val filteredPendingMessages by remember(pendingMessages, searchQuery) {
        derivedStateOf {
            if (searchQuery.isBlank()) pendingMessages
            else pendingMessages.filter {
                it.content.contains(searchQuery, ignoreCase = true) ||
                    it.sender.contains(searchQuery, ignoreCase = true) ||
                    it.appName.contains(searchQuery, ignoreCase = true)
            }
        }
    }
    val filteredCompletedMessages by remember(completedTodayMessages, searchQuery) {
        derivedStateOf {
            if (searchQuery.isBlank()) completedTodayMessages
            else completedTodayMessages.filter {
                it.content.contains(searchQuery, ignoreCase = true) ||
                    it.sender.contains(searchQuery, ignoreCase = true) ||
                    it.appName.contains(searchQuery, ignoreCase = true)
            }
        }
    }

    NotiFlowScreenWrapper(
        title = "대시보드",
        expandedHeight = 140.dp,
        expandedContent = {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                DashboardSearchBar(
                    query = searchQuery,
                    onQueryChange = { searchQuery = it }
                )
                Spacer(modifier = Modifier.height(8.dp))
                InlineStatsRow(
                    todayCount = todayCount,
                    todayDelta = todayDelta,
                    pendingCount = pendingCount,
                    urgentCount = urgentCount,
                    completedToday = completedTodayCount,
                    completionRate = completionRate,
                    onTodayClick = { onNavigateToMessages(null, false) },
                    onPendingClick = {
                        val firstStepId = statusSteps.firstOrNull()?.id
                        onNavigateToMessages(firstStepId, false)
                    },
                    onCompletedClick = {
                        val lastStepId = statusSteps.lastOrNull()?.id
                        onNavigateToMessages(lastStepId, true)
                    }
                )
            }
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // 미처리 메시지 섹션
            PendingMessagesSection(
                pendingCount = if (searchQuery.isBlank()) pendingCount else filteredPendingMessages.size,
                messages = filteredPendingMessages,
                categories = categories.associate { it.id to Pair(it.name, it.color) },
                statusSteps = statusSteps,
                onMessageClick = onMessageClick,
                onCheckMessage = { messageId -> viewModel.moveToNextStatus(messageId) },
                onStatusSelect = { messageId, statusId -> viewModel.moveToStatus(messageId, statusId) },
                onMoreClick = {
                    val firstStepId = statusSteps.firstOrNull()?.id
                    onNavigateToMessages(firstStepId, false)
                },
                calculateUrgency = { viewModel.calculateUrgency(it) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 카테고리별 현황
            CategorySummarySection(
                summaries = categorySummaries,
                onCategoryClick = onNavigateToCategoryMessages
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 오늘 완료 섹션
            CompletedTodaySection(
                completedCount = if (searchQuery.isBlank()) completedTodayCount else filteredCompletedMessages.size,
                messages = filteredCompletedMessages,
                categories = categories.associate { it.id to Pair(it.name, it.color) },
                onMessageClick = onMessageClick,
                onMoreClick = {
                    val lastStepId = statusSteps.lastOrNull()?.id
                    onNavigateToMessages(lastStepId, true)
                }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 알림 인사이트 섹션
            com.hart.notimgmt.ui.insight.InsightSection()

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

/**
 * 대시보드 검색바 — 글래스 스타일 (40dp)
 */
@Composable
private fun DashboardSearchBar(
    query: String,
    onQueryChange: (String) -> Unit
) {
    val glassColors = TwsTheme.glassColors

    Surface(
        modifier = Modifier
            .fillMaxWidth()
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
                                text = "메시지 검색...",
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

/**
 * 인라인 통계 행 — 컴팩트 버전 (기존 CompactStatsBar 대체)
 */
@Composable
private fun InlineStatsRow(
    todayCount: Int,
    todayDelta: Int,
    pendingCount: Int,
    urgentCount: Int,
    completedToday: Int,
    completionRate: Int,
    onTodayClick: () -> Unit,
    onPendingClick: () -> Unit,
    onCompletedClick: () -> Unit
) {
    val glassColors = TwsTheme.glassColors

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = glassColors.surface.copy(alpha = 0.6f),
        border = BorderStroke(0.5.dp, glassColors.border.copy(alpha = 0.3f))
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            // 오늘
            StatItem(
                modifier = Modifier
                    .weight(1f)
                    .clickable(onClick = onTodayClick)
                    .padding(vertical = 8.dp),
                label = "오늘",
                value = "$todayCount",
                subValue = if (todayDelta >= 0) "+$todayDelta" else "$todayDelta",
                subColor = if (todayDelta >= 0) MaterialTheme.colorScheme.primary
                           else MaterialTheme.colorScheme.error
            )

            VerticalDivider()

            // 미처리
            val pendingColor = when {
                pendingCount == 0 -> Color(0xFF10B981)
                urgentCount > 0 -> MaterialTheme.colorScheme.error
                else -> Color(0xFFF59E0B)
            }
            StatItem(
                modifier = Modifier
                    .weight(1f)
                    .clickable(onClick = onPendingClick)
                    .padding(vertical = 8.dp),
                label = "미처리",
                value = "$pendingCount",
                valueColor = pendingColor,
                subValue = if (urgentCount > 0) "긴급$urgentCount" else null,
                subColor = MaterialTheme.colorScheme.error
            )

            VerticalDivider()

            // 완료
            StatItem(
                modifier = Modifier
                    .weight(1f)
                    .clickable(onClick = onCompletedClick)
                    .padding(vertical = 8.dp),
                label = "완료",
                value = "$completedToday",
                subValue = "$completionRate%",
                subColor = Color(0xFF10B981)
            )
        }
    }
}

@Composable
private fun StatItem(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    valueColor: Color = MaterialTheme.colorScheme.onSurface,
    subValue: String?,
    subColor: Color
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = valueColor
        )
        if (subValue != null) {
            Text(
                text = subValue,
                style = MaterialTheme.typography.labelSmall,
                color = subColor,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun VerticalDivider() {
    Box(
        modifier = Modifier
            .width(0.5.dp)
            .height(48.dp)
            .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PendingMessagesSection(
    pendingCount: Int,
    messages: List<CapturedMessageEntity>,
    categories: Map<String, Pair<String, Int>>,
    statusSteps: List<StatusStepEntity>,
    onMessageClick: (String) -> Unit,
    onCheckMessage: (String) -> Unit,
    onStatusSelect: (String, String) -> Unit,
    onMoreClick: () -> Unit,
    calculateUrgency: (Long) -> UrgencyLevel
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "🔴 미처리 메시지",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.width(8.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (pendingCount > 0) MaterialTheme.colorScheme.error.copy(alpha = 0.1f)
                    else MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Text(
                        text = "$pendingCount",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (pendingCount > 0) MaterialTheme.colorScheme.error
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }
            TextButton(onClick = onMoreClick) {
                Text("더보기")
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        if (messages.isEmpty()) {
            EmptySection(text = "미처리 메시지가 없습니다")
        } else {
            val grouped = messages.groupBy { getDateKey(it.receivedAt) }
                .toSortedMap(compareByDescending { it })
            val groupEntries = grouped.entries.toList()

            Column {
                groupEntries.forEachIndexed { groupIndex, (dateKey, messagesForDate) ->
                    DashboardTimelineDateHeader(dateKey)
                    val isLastGroup = groupIndex == groupEntries.lastIndex

                    messagesForDate.forEachIndexed { index, message ->
                        val isLast = isLastGroup && index == messagesForDate.lastIndex
                        val urgency = calculateUrgency(message.receivedAt)
                        val category = message.categoryId?.let { categories[it] }

                        DashboardTimelineItem(
                            message = message,
                            categoryColor = category?.second,
                            isLast = isLast
                        ) {
                            PendingMessageCard(
                                message = message,
                                urgencyLevel = urgency,
                                categoryName = category?.first,
                                categoryColor = category?.second,
                                statusSteps = statusSteps,
                                onCheck = { onCheckMessage(message.id) },
                                onStatusSelect = { statusId -> onStatusSelect(message.id, statusId) },
                                onClick = { onMessageClick(message.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PendingMessageCard(
    message: CapturedMessageEntity,
    urgencyLevel: UrgencyLevel,
    categoryName: String?,
    categoryColor: Int?,
    statusSteps: List<StatusStepEntity>,
    onCheck: () -> Unit,
    onStatusSelect: (String) -> Unit,
    onClick: () -> Unit
) {
    var showStatusMenu by remember { mutableStateOf(false) }
    val glassColors = TwsTheme.glassColors

    val backgroundColor by animateColorAsState(
        when (urgencyLevel) {
            UrgencyLevel.URGENT -> MaterialTheme.colorScheme.error.copy(alpha = 0.08f)
            UrgencyLevel.WARNING -> Color(0xFFF59E0B).copy(alpha = 0.08f)
            UrgencyLevel.NORMAL -> glassColors.surface
        },
        label = "bgColor"
    )

    val borderColor = when (urgencyLevel) {
        UrgencyLevel.URGENT -> MaterialTheme.colorScheme.error.copy(alpha = 0.5f)
        UrgencyLevel.WARNING -> Color(0xFFF59E0B).copy(alpha = 0.5f)
        UrgencyLevel.NORMAL -> glassColors.border
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(end = 4.dp, top = 4.dp, bottom = 4.dp)
            .shadow(
                elevation = 4.dp,
                shape = RoundedCornerShape(16.dp),
                ambientColor = glassColors.shadow,
                spotColor = glassColors.shadow
            )
            .combinedClickable(
                onClick = onClick,
                onLongClick = { showStatusMenu = true }
            ),
        shape = RoundedCornerShape(16.dp),
        color = backgroundColor,
        border = BorderStroke(1.dp, borderColor)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // 1행: 프로필 사진 + 발신자 + 카테고리 태그
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
                if (categoryName != null) {
                    val catColor = categoryColor?.let { Color(it) } ?: MaterialTheme.colorScheme.primary
                    Text(
                        text = categoryName,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = catColor,
                        modifier = Modifier
                            .background(
                                color = catColor.copy(alpha = 0.1f),
                                shape = RoundedCornerShape(12.dp)
                            )
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }

            // 2행: 긴급뱃지 + 앱이름 · 시간
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (urgencyLevel != UrgencyLevel.NORMAL) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = when (urgencyLevel) {
                            UrgencyLevel.URGENT -> MaterialTheme.colorScheme.error
                            UrgencyLevel.WARNING -> Color(0xFFF59E0B)
                            else -> Color.Transparent
                        }
                    ) {
                        Text(
                            text = when (urgencyLevel) {
                                UrgencyLevel.URGENT -> "긴급"
                                UrgencyLevel.WARNING -> "주의"
                                else -> ""
                            },
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                }

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
                    text = formatTimeAgo(message.receivedAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = when (urgencyLevel) {
                        UrgencyLevel.URGENT -> MaterialTheme.colorScheme.error
                        UrgencyLevel.WARNING -> Color(0xFFF59E0B)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontWeight = if (urgencyLevel != UrgencyLevel.NORMAL) FontWeight.Medium else FontWeight.Normal
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            // 3행: 메시지 내용
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(8.dp))

            // 4행: 상태 칩 + 다음 상태 버튼
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // 상태 칩 + 드롭다운
                if (statusSteps.isNotEmpty()) {
                    val currentStep = statusSteps.find { it.id == message.statusId }
                    val chipColor = currentStep?.let { Color(it.color) }
                        ?: MaterialTheme.colorScheme.onSurfaceVariant

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
                                    text = currentStep?.name ?: "상태 없음",
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
                            statusSteps.forEach { step ->
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
                                        onStatusSelect(step.id)
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

                Spacer(modifier = Modifier.weight(1f))

                // 다음 상태 버튼
                IconButton(
                    onClick = onCheck,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        Icons.Default.RadioButtonUnchecked,
                        contentDescription = "다음 상태로",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun CategorySummarySection(
    summaries: List<CategorySummary>,
    onCategoryClick: (String?) -> Unit
) {
    val glassColors = TwsTheme.glassColors

    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Text(
            text = "📊 카테고리별 현황",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (summaries.isEmpty()) {
            EmptySection(text = "미처리 메시지가 없습니다")
        } else {
            val maxCount = summaries.maxOfOrNull { it.pendingCount } ?: 1

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(
                        elevation = 8.dp,
                        shape = RoundedCornerShape(16.dp),
                        ambientColor = glassColors.shadow,
                        spotColor = glassColors.shadow
                    ),
                shape = RoundedCornerShape(16.dp),
                color = glassColors.surface,
                border = BorderStroke(1.dp, glassColors.border)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    summaries.forEachIndexed { index, summary ->
                        if (index > 0) {
                            HorizontalDivider(
                                modifier = Modifier.padding(vertical = 8.dp),
                                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                            )
                        }

                        CategorySummaryRow(
                            summary = summary,
                            maxCount = maxCount,
                            onClick = { onCategoryClick(summary.categoryId) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CategorySummaryRow(
    summary: CategorySummary,
    maxCount: Int,
    onClick: () -> Unit
) {
    val progress by animateFloatAsState(
        targetValue = if (maxCount > 0) summary.pendingCount.toFloat() / maxCount else 0f,
        label = "progress"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 카테고리 색상 점
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(Color(summary.color))
        )

        Spacer(modifier = Modifier.width(10.dp))

        Text(
            text = summary.name,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.width(60.dp)
        )

        Spacer(modifier = Modifier.width(8.dp))

        // 진행 막대
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .weight(1f)
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = Color(summary.color),
            trackColor = MaterialTheme.colorScheme.surfaceVariant
        )

        Spacer(modifier = Modifier.width(12.dp))

        // 건수
        Text(
            text = "${summary.pendingCount}건",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.width(36.dp)
        )

        // 긴급 건수
        if (summary.urgentCount > 0) {
            Text(
                text = "(${summary.urgentCount}긴급)",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
fun CompletedTodaySection(
    completedCount: Int,
    messages: List<CapturedMessageEntity>,
    categories: Map<String, Pair<String, Int>>,
    onMessageClick: (String) -> Unit,
    onMoreClick: () -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "✅ 오늘 완료",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.width(8.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFF10B981).copy(alpha = 0.1f)
                ) {
                    Text(
                        text = "$completedCount",
                        style = MaterialTheme.typography.labelMedium,
                        color = Color(0xFF10B981),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }
            TextButton(onClick = onMoreClick) {
                Text("더보기")
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        if (messages.isEmpty()) {
            EmptySection(text = "오늘 완료한 메시지가 없습니다")
        } else {
            val grouped = messages.groupBy { getDateKey(it.statusChangedAt ?: it.updatedAt) }
                .toSortedMap(compareByDescending { it })
            val groupEntries = grouped.entries.toList()

            Column {
                groupEntries.forEachIndexed { groupIndex, (dateKey, messagesForDate) ->
                    DashboardTimelineDateHeader(dateKey)
                    val isLastGroup = groupIndex == groupEntries.lastIndex

                    messagesForDate.forEachIndexed { index, message ->
                        val isLast = isLastGroup && index == messagesForDate.lastIndex
                        val category = message.categoryId?.let { categories[it] }

                        DashboardTimelineItem(
                            message = message,
                            categoryColor = category?.second,
                            isLast = isLast
                        ) {
                            CompletedMessageCard(
                                message = message,
                                completedAt = message.statusChangedAt ?: message.updatedAt,
                                categoryName = category?.first,
                                categoryColor = category?.second,
                                onClick = { onMessageClick(message.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CompletedMessageCard(
    message: CapturedMessageEntity,
    completedAt: Long,
    categoryName: String?,
    categoryColor: Int?,
    onClick: () -> Unit
) {
    val glassColors = TwsTheme.glassColors

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(end = 4.dp, top = 4.dp, bottom = 4.dp)
            .shadow(
                elevation = 4.dp,
                shape = RoundedCornerShape(16.dp),
                ambientColor = glassColors.shadow,
                spotColor = glassColors.shadow
            )
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = glassColors.surfaceLight,
        border = BorderStroke(1.dp, glassColors.border)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // 1행: 프로필 사진 + 발신자 + 카테고리 태그
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
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                    modifier = Modifier.weight(1f, fill = false)
                )

                Spacer(modifier = Modifier.width(8.dp))

                // 카테고리 태그
                if (categoryName != null) {
                    val catColor = categoryColor?.let { Color(it) } ?: MaterialTheme.colorScheme.primary
                    Text(
                        text = categoryName,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = catColor.copy(alpha = 0.7f),
                        modifier = Modifier
                            .background(
                                color = catColor.copy(alpha = 0.08f),
                                shape = RoundedCornerShape(12.dp)
                            )
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }

            // 2행: 앱이름 · 완료시간 + 완료 뱃지
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (message.appName.isNotEmpty() && message.appName != message.sender) {
                        Text(
                            text = message.appName,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                            maxLines = 1
                        )
                        Text(
                            text = " · ",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }
                    Text(
                        text = formatCompletedTime(completedAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                    )
                }

                // 완료 뱃지
                Text(
                    text = "✓ 완료",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF10B981),
                    modifier = Modifier
                        .background(
                            color = Color(0xFF10B981).copy(alpha = 0.1f),
                            shape = RoundedCornerShape(6.dp)
                        )
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // 3행: 메시지 내용
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun DashboardTimelineDateHeader(dateKey: String) {
    val displayDate = formatDateHeader(dateKey)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary)
        )

        Spacer(modifier = Modifier.width(12.dp))

        Text(
            text = displayDate,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.width(12.dp))

        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        )
    }
}

@Composable
private fun DashboardTimelineItem(
    message: CapturedMessageEntity,
    categoryColor: Int?,
    isLast: Boolean,
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    val catColor = categoryColor?.let { Color(it) } ?: MaterialTheme.colorScheme.primary

    Row(modifier = Modifier.fillMaxWidth()) {
        // 타임라인 좌측 컬럼 (앱 아이콘 + 시간 + 연결선)
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

            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = formatTimeShort(message.receivedAt),
                style = MaterialTheme.typography.labelSmall,
                fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.85f,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1
            )

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

        // 우측 카드 컨텐츠
        Box(modifier = Modifier.weight(1f)) {
            content()
        }
    }
}

@Composable
private fun EmptySection(text: String) {
    val glassColors = TwsTheme.glassColors

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = glassColors.surfaceLight,
        border = BorderStroke(1.dp, glassColors.border)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Inbox,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = text,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun formatTimeAgo(timestamp: Long): String {
    return SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault()).format(Date(timestamp))
}

private fun formatCompletedTime(timestamp: Long): String {
    return SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault()).format(Date(timestamp))
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
