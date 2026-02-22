package com.hart.notimgmt.ui.message

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.MoveUp
import androidx.compose.material.icons.filled.SelectAll
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Image
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.ui.calendar.CalendarGrid
import com.hart.notimgmt.ui.components.EmptyState
import com.hart.notimgmt.ui.components.HighlightedText
import com.hart.notimgmt.ui.components.PermissionBanner
import com.hart.notimgmt.data.model.SortOrder
import com.hart.notimgmt.ui.components.ConfirmDialog
import com.hart.notimgmt.ui.navigation.LocalSnackbarHostState
import com.hart.notimgmt.ui.navigation.Routes
import com.hart.notimgmt.ui.theme.DEFAULT_CATEGORY_COLOR
import com.hart.notimgmt.ui.theme.NotiFlowWarning
import com.hart.notimgmt.viewmodel.CalendarViewModel
import com.hart.notimgmt.viewmodel.MessageViewModel
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessageListScreen(
    navController: NavController,
    initialStatusFilter: String? = null,
    initialCompletedTodayFilter: Boolean = false,
    viewModel: MessageViewModel = hiltViewModel(),
    calendarViewModel: CalendarViewModel = hiltViewModel()
) {
    // 초기 필터 적용
    LaunchedEffect(initialStatusFilter, initialCompletedTodayFilter) {
        viewModel.setFilterStatus(initialStatusFilter)
        viewModel.setFilterCompletedToday(initialCompletedTodayFilter)
    }

    val categories by viewModel.categories.collectAsState()
    val messages by viewModel.messages.collectAsState()
    val allStatusSteps by viewModel.allStatusSteps.collectAsState()
    val filterStatusId by viewModel.filterStatusId.collectAsState()
    val filterCompletedToday by viewModel.filterCompletedToday.collectAsState()
    val currentSortOrder by viewModel.sortOrder.collectAsState()
    val selectionMode by viewModel.selectionMode.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()
    val selectedCategoryIds by viewModel.selectedCategoryIds.collectAsState()
    val showCategoryFilter by viewModel.showCategoryFilter.collectAsState()
    val deletedCount by viewModel.deletedCount.collectAsState()
    val snackbarHostState = LocalSnackbarHostState.current
    val coroutineScope = rememberCoroutineScope()

    // 캘린더 상태
    val currentMonth by calendarViewModel.currentMonth.collectAsState()
    val selectedCalendarDate by calendarViewModel.selectedDate.collectAsState()
    val calendarCategories by calendarViewModel.categories.collectAsState()
    val messageDaysRaw by calendarViewModel.messageDaysInMonth.collectAsState()

    val calendarCategoryColors = remember(calendarCategories) {
        calendarCategories.associate { it.id to it.color }
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

    val listState = rememberLazyListState()

    val filterCount = selectedCategoryIds?.size ?: 0
    val isFiltered = selectedCategoryIds != null

    var searchQuery by remember { mutableStateOf("") }
    var isSearchExpanded by remember { mutableStateOf(false) }

    // 스크롤 방향에 따라 검색바 표시/숨김
    val searchScrollConnection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                // 위로 스크롤 (available.y < 0) → 검색바 숨김
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
                // 아래로 스와이프 시 콘텐츠가 더 이상 스크롤 안 됨 (리스트 최상단) → 검색바 표시
                if (available.y > 10f) {
                    isSearchExpanded = true
                }
                return Offset.Zero
            }
        }
    }
    var showSortMenu by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showBulkCategoryDialog by remember { mutableStateOf(false) }
    var selectedDateFilter by remember { mutableStateOf<LocalDate?>(null) }

    val filteredMessages = remember(messages, searchQuery, selectedDateFilter) {
        var result = if (searchQuery.isBlank()) messages
        else messages.filter {
            it.sender.contains(searchQuery, ignoreCase = true) ||
                it.content.contains(searchQuery, ignoreCase = true) ||
                it.appName.contains(searchQuery, ignoreCase = true)
        }
        if (selectedDateFilter != null) {
            val targetKey = "%04d-%02d-%02d".format(
                selectedDateFilter!!.year, selectedDateFilter!!.monthValue, selectedDateFilter!!.dayOfMonth
            )
            result = result.filter { getDateKey(it.receivedAt) == targetKey }
        }
        result
    }

    // 날짜별 그룹화
    val groupedMessages = remember(filteredMessages) {
        filteredMessages.groupBy { message ->
            getDateKey(message.receivedAt)
        }.toSortedMap(compareByDescending { it })
    }

    // 삭제 확인 다이얼로그
    if (showDeleteDialog) {
        ConfirmDialog(
            title = "메시지 삭제",
            message = "${selectedIds.size}개의 메시지를 삭제하시겠습니까?",
            confirmText = "삭제",
            onConfirm = {
                viewModel.bulkDelete()
                showDeleteDialog = false
                coroutineScope.launch {
                    snackbarHostState.showSnackbar("${selectedIds.size}개 메시지가 삭제되었습니다")
                }
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    // 벌크 카테고리 변경 다이얼로그
    if (showBulkCategoryDialog) {
        val bulkCount = selectedIds.size
        CategorySelectDialog(
            categories = categories,
            currentCategoryId = null,
            onSelect = { categoryId ->
                viewModel.bulkUpdateCategory(categoryId)
                showBulkCategoryDialog = false
                val categoryName = categories.find { it.id == categoryId }?.name ?: ""
                coroutineScope.launch {
                    snackbarHostState.showSnackbar("${bulkCount}개 메시지가 '${categoryName}'(으)로 이동되었습니다")
                }
            },
            onDismiss = { showBulkCategoryDialog = false }
        )
    }

    var showCalendarSheet by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)

    Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
        PermissionBanner()

        // 선택 모드 액션바 또는 일반 헤더
        if (selectionMode) {
            SelectionModeBar(
                selectedCount = selectedIds.size,
                totalCount = filteredMessages.size,
                onSelectAll = { viewModel.selectAll(filteredMessages.map { it.id }) },
                onMoveCategory = { showBulkCategoryDialog = true },
                onDelete = { showDeleteDialog = true },
                onCancel = { viewModel.exitSelectionMode() }
            )
        } else {
            TopAppBar(
                title = {
                    val total = messages.size
                    val filtered = filteredMessages.size
                    val countText = if ((searchQuery.isNotBlank() || selectedDateFilter != null) && filtered != total) {
                        "메시지 ($filtered/$total)"
                    } else {
                        "메시지 ($total)"
                    }
                    Text(countText, style = MaterialTheme.typography.headlineSmall)
                },
                actions = {
                    IconButton(onClick = { showCalendarSheet = true }) {
                        Icon(
                            Icons.Default.CalendarMonth,
                            contentDescription = "캘린더",
                            tint = if (selectedDateFilter != null)
                                MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = { isSearchExpanded = !isSearchExpanded }) {
                        Icon(
                            Icons.Default.Search,
                            contentDescription = "검색",
                            tint = if (isSearchExpanded || searchQuery.isNotBlank())
                                MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
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
                    Box {
                        IconButton(onClick = { showSortMenu = true }) {
                            Icon(
                                Icons.AutoMirrored.Filled.Sort,
                                contentDescription = "정렬",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        DropdownMenu(
                            expanded = showSortMenu,
                            onDismissRequest = { showSortMenu = false }
                        ) {
                            SortOrder.entries.forEach { order ->
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            order.label,
                                            color = if (order == currentSortOrder) MaterialTheme.colorScheme.primary
                                            else MaterialTheme.colorScheme.onSurface
                                        )
                                    },
                                    onClick = {
                                        viewModel.setSortOrder(order)
                                        showSortMenu = false
                                    }
                                )
                            }
                        }
                    }
                    IconButton(onClick = { navController.navigate(Routes.TRASH) }) {
                        Box {
                            Icon(
                                Icons.Default.DeleteOutline,
                                contentDescription = "휴지통",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (deletedCount > 0) {
                                Surface(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .size(16.dp),
                                    shape = CircleShape,
                                    color = MaterialTheme.colorScheme.error
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(
                                            text = if (deletedCount > 99) "99+" else "$deletedCount",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onError
                                        )
                                    }
                                }
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )

            // 검색창 (펼침 시만 표시)
            AnimatedVisibility(
                visible = isSearchExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                TextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    placeholder = {
                        Text(
                            "발신자, 내용, 앱 이름으로 검색",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    trailingIcon = {
                        if (searchQuery.isNotBlank()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "지우기",
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent
                    ),
                    textStyle = MaterialTheme.typography.bodySmall
                )
            }

            // 카테고리 필터 (접이식)
            AnimatedVisibility(
                visible = showCategoryFilter,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                        .padding(horizontal = 16.dp, vertical = 8.dp)
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

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        categories.forEach { category ->
                            MessageCategoryFilterChip(
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

        // 상태 필터 표시
        val hasStatusFilter = filterStatusId != null || filterCompletedToday
        if (hasStatusFilter) {
            val statusName = filterStatusId?.let { id ->
                allStatusSteps.find { it.id == id }?.name
            }
            val filterLabel = when {
                filterCompletedToday && statusName != null -> "오늘 $statusName"
                filterCompletedToday -> "오늘 완료"
                statusName != null -> statusName
                else -> ""
            }
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.FilterList,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "필터: $filterLabel",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                    Surface(
                        onClick = { viewModel.clearFilters() },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.1f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "필터 해제",
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "해제",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }
            }
        }

        // 날짜 필터 표시 + 좌우 이동 버튼
        if (selectedDateFilter != null) {
            val df = selectedDateFilter!!
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 4.dp, end = 12.dp, top = 4.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // 이전 날짜
                    IconButton(
                        onClick = {
                            val prev = df.minusDays(1)
                            selectedDateFilter = prev
                            calendarViewModel.goToDate(prev)
                        },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = "이전 날짜",
                            modifier = Modifier.size(20.dp),
                            tint = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }
                    // 날짜 표시
                    Row(
                        modifier = Modifier.weight(1f),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.CalendarMonth,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "${df.year}년 ${df.monthValue}월 ${df.dayOfMonth}일",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }
                    // 다음 날짜
                    IconButton(
                        onClick = {
                            val next = df.plusDays(1)
                            selectedDateFilter = next
                            calendarViewModel.goToDate(next)
                        },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowRight,
                            contentDescription = "다음 날짜",
                            modifier = Modifier.size(20.dp),
                            tint = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    // 해제
                    Surface(
                        onClick = { selectedDateFilter = null },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.1f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "날짜 필터 해제",
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "해제",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }
                    }
                }
            }
        }

        // 메시지 리스트 영역
        if (filteredMessages.isEmpty()) {
            if (searchQuery.isNotBlank()) {
                EmptyState(
                    icon = Icons.Default.Search,
                    title = "검색 결과가 없습니다",
                    description = "'$searchQuery'에 대한 결과를 찾을 수 없습니다",
                    modifier = Modifier.fillMaxSize().weight(1f)
                )
            } else if (hasStatusFilter || selectedDateFilter != null) {
                EmptyState(
                    icon = Icons.Default.Inbox,
                    title = "조건에 맞는 메시지가 없습니다",
                    description = "필터를 해제하면 전체 메시지를 볼 수 있습니다",
                    modifier = Modifier.fillMaxSize().weight(1f)
                )
            } else {
                EmptyState(
                    icon = Icons.Default.Inbox,
                    title = "수집된 알림이 없습니다",
                    description = "설정에서 앱을 선택하면\n알림이 자동으로 수집됩니다",
                    modifier = Modifier.fillMaxSize().weight(1f)
                )
            }
        } else {
            // 타임라인 형식 메시지 리스트
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .weight(1f)
                    .nestedScroll(searchScrollConnection),
                contentPadding = PaddingValues(top = 8.dp, bottom = 88.dp)
            ) {
                val groupEntries = groupedMessages.entries.toList()
                groupEntries.forEachIndexed { groupIndex, (dateKey, messagesForDate) ->
                    // 날짜 헤더
                    item(key = "header_$dateKey") {
                        TimelineDateHeader(dateKey = dateKey)
                    }

                    val isLastGroup = groupIndex == groupEntries.lastIndex

                    // 해당 날짜의 메시지들
                    itemsIndexed(
                        items = messagesForDate,
                        key = { _, message -> message.id }
                    ) { index, message ->
                        val category = message.categoryId?.let { catId ->
                            categories.find { it.id == catId }
                        }
                        val categoryName = category?.name ?: ""
                        val categoryColor = category?.color ?: DEFAULT_CATEGORY_COLOR
                        val steps = allStatusSteps
                        val currentStatus = steps.find { it.id == message.statusId }
                        // 전체 리스트의 마지막 아이템만 선 없음
                        val isAbsolutelyLast = isLastGroup && index == messagesForDate.lastIndex

                        TimelineMessageItem(
                            message = message,
                            categoryName = categoryName,
                            categoryColor = categoryColor,
                            statusName = currentStatus?.name,
                            statusColor = currentStatus?.color,
                            allStatusSteps = steps,
                            isLastInGroup = isAbsolutelyLast,
                            selectionMode = selectionMode,
                            isSelected = selectedIds.contains(message.id),
                            onMessageClick = {
                                if (selectionMode) {
                                    viewModel.toggleSelection(message.id)
                                } else {
                                    navController.navigate("message_detail/${message.id}")
                                }
                            },
                            onLongClick = {
                                if (!selectionMode) {
                                    viewModel.enterSelectionMode(message.id)
                                }
                            },
                            onStatusChange = { statusId ->
                                viewModel.updateMessageStatus(message.id, statusId)
                            },
                            searchQuery = searchQuery
                        )
                    }
                }
            }
        }

        // 캘린더 바텀시트 (조건부 표시)
        if (showCalendarSheet) {
            ModalBottomSheet(
                onDismissRequest = { showCalendarSheet = false },
                sheetState = sheetState,
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                // 날짜 전후 이동 버튼 (캘린더 위)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val baseDate = selectedDateFilter ?: LocalDate.now()

                    // 이전 날짜
                    Surface(
                        onClick = {
                            val prev = baseDate.minusDays(1)
                            calendarViewModel.goToDate(prev)
                            selectedDateFilter = prev
                        },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                                contentDescription = "이전 날짜",
                                modifier = Modifier.size(20.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            val prevDate = baseDate.minusDays(1)
                            Text(
                                text = "${prevDate.monthValue}/${prevDate.dayOfMonth}",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    // 오늘 버튼
                    Surface(
                        onClick = {
                            val today = LocalDate.now()
                            calendarViewModel.goToDate(today)
                            selectedDateFilter = today
                        },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
                    ) {
                        Text(
                            text = "오늘",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                        )
                    }

                    // 다음 날짜
                    Surface(
                        onClick = {
                            val next = baseDate.plusDays(1)
                            calendarViewModel.goToDate(next)
                            selectedDateFilter = next
                        },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val nextDate = baseDate.plusDays(1)
                            Text(
                                text = "${nextDate.monthValue}/${nextDate.dayOfMonth}",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = "다음 날짜",
                                modifier = Modifier.size(20.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                CalendarGrid(
                    yearMonth = currentMonth,
                    selectedDate = selectedCalendarDate,
                    messageDays = messageDays,
                    categoryColors = calendarCategoryColors,
                    onDateClick = { date ->
                        calendarViewModel.selectDate(date)
                        selectedDateFilter = if (selectedDateFilter == date) null else date
                    },
                    onPreviousMonth = { calendarViewModel.previousMonth() },
                    onNextMonth = { calendarViewModel.nextMonth() }
                )

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    } // Column
}

// 타임라인 날짜 헤더
@Composable
private fun TimelineDateHeader(dateKey: String) {
    val displayDate = formatDateHeader(dateKey)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 날짜 마커
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

        // 구분선
        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        )
    }
}

// 타임라인 메시지 아이템
@Composable
private fun TimelineMessageItem(
    message: CapturedMessageEntity,
    categoryName: String,
    categoryColor: Int,
    statusName: String?,
    statusColor: Int?,
    allStatusSteps: List<StatusStepEntity>,
    isLastInGroup: Boolean,
    selectionMode: Boolean,
    isSelected: Boolean,
    onMessageClick: () -> Unit,
    onLongClick: () -> Unit,
    onStatusChange: (String) -> Unit,
    searchQuery: String = ""
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
                // 폴백: 카테고리 색상 아이콘
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
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1
            )

            // 연결선
            if (!isLastInGroup) {
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
        TimelineMessageCard(
            message = message,
            categoryName = categoryName,
            categoryColor = categoryColor,
            statusName = statusName,
            statusColor = statusColor,
            allStatusSteps = allStatusSteps,
            onClick = onMessageClick,
            onLongClick = onLongClick,
            onStatusChange = onStatusChange,
            isSelectionMode = selectionMode,
            isSelected = isSelected,
            searchQuery = searchQuery,
            modifier = Modifier.weight(1f)
        )
    }
}

// 타임라인용 메시지 카드 (시간 표시 제거)
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TimelineMessageCard(
    message: CapturedMessageEntity,
    categoryName: String,
    categoryColor: Int,
    statusName: String?,
    statusColor: Int?,
    allStatusSteps: List<StatusStepEntity>,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onStatusChange: (String) -> Unit,
    isSelectionMode: Boolean,
    isSelected: Boolean,
    searchQuery: String = "",
    modifier: Modifier = Modifier
) {
    val catColor = Color(categoryColor)
    val borderColor = when {
        isSelected -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
    }
    val bgColor = when {
        isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
        else -> MaterialTheme.colorScheme.surface
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = 8.dp, end = 16.dp, top = 4.dp, bottom = 4.dp)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = RoundedCornerShape(12.dp),
        color = bgColor,
        border = BorderStroke(if (isSelected) 1.5.dp else 0.5.dp, borderColor)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 선택 모드 체크박스
            if (isSelectionMode) {
                Box(
                    modifier = Modifier.padding(start = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isSelected) Icons.Default.CheckCircle
                        else Icons.Default.RadioButtonUnchecked,
                        contentDescription = if (isSelected) "선택됨" else "선택 안됨",
                        tint = if (isSelected) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(12.dp)
            ) {
                // 발신자 + 프로필 사진 + 카테고리
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // 핀 아이콘
                    if (message.isPinned) {
                        Icon(
                            imageVector = Icons.Default.PushPin,
                            contentDescription = "고정됨",
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                    }

                    // 발신자 프로필 사진 (senderIcon = 메신저 프로필)
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

                    HighlightedText(
                        text = message.sender.ifEmpty { message.appName },
                        query = searchQuery,
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
                        HighlightedText(
                            text = message.appName,
                            query = searchQuery,
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

                Spacer(modifier = Modifier.height(8.dp))

                // 메시지 내용
                HighlightedText(
                    text = message.content,
                    query = searchQuery,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // 스누즈 표시
                if (message.snoozeAt != null && message.snoozeAt > System.currentTimeMillis()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Alarm,
                            contentDescription = "스누즈",
                            modifier = Modifier.size(12.dp),
                            tint = NotiFlowWarning
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = formatSnoozeTime(message.snoozeAt),
                            style = MaterialTheme.typography.labelSmall,
                            color = NotiFlowWarning
                        )
                    }
                }

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

// 날짜 키 생성 (yyyy-MM-dd)
private fun getDateKey(timestamp: Long): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

// 날짜 헤더 포맷
private fun formatDateHeader(dateKey: String): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val date = sdf.parse(dateKey) ?: return dateKey
    val displayFormat = SimpleDateFormat("yyyy/MM/dd (E)", Locale.KOREAN)
    return displayFormat.format(date)
}

// 시간 포맷
private fun formatTime(timestamp: Long): String {
    val sdf = SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

// 타임라인 아이콘 하단 시간 포맷 (HH:mm)
private fun formatTimeShort(timestamp: Long): String {
    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

@Composable
private fun SelectionModeBar(
    selectedCount: Int,
    totalCount: Int,
    onSelectAll: () -> Unit,
    onMoveCategory: () -> Unit,
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
                    if (isAllSelected) "선택됨" else "전체선택",
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(
                onClick = onMoveCategory,
                enabled = selectedCount > 0
            ) {
                Icon(
                    Icons.Default.MoveUp,
                    contentDescription = "카테고리 이동",
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
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
                    Icons.Default.Delete,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("삭제")
            }
        }
    }
}

@Composable
private fun MessageCategoryFilterChip(
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
