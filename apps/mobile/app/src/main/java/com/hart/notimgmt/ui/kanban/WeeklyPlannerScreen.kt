package com.hart.notimgmt.ui.kanban

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.LinkOff
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.data.db.entity.PlanEntity
import com.hart.notimgmt.ui.components.NotiFlowScreenWrapper
import com.hart.notimgmt.ui.theme.TwsTheme
import com.hart.notimgmt.viewmodel.WeeklyPlannerViewModel
import com.hart.notimgmt.viewmodel.WeeklyPlannerViewModel.Companion.toEpochMillis
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Locale

private val DAY_LABELS = listOf("월", "화", "수", "목", "금", "토", "일")

@Composable
fun WeeklyPlannerScreen(
    viewModel: WeeklyPlannerViewModel = hiltViewModel(),
    onMessageClick: (String) -> Unit = {}
) {
    val categories by viewModel.categories.collectAsState()
    val weekPlans by viewModel.weekPlans.collectAsState()
    val weekMessages by viewModel.weekMessages.collectAsState()
    val currentMonday by viewModel.currentWeekMonday.collectAsState()
    val weekDayCategories by viewModel.weekDayCategories.collectAsState()
    val uncategorizedMessages by viewModel.uncategorizedMessages.collectAsState()
    val allActiveCategories = remember(categories) {
        categories.filter { it.isActive && !it.isDeleted }
    }

    val scope = rememberCoroutineScope()
    val today = remember { LocalDate.now() }
    val todayDayIndex = remember { (today.dayOfWeek.value - 1).coerceIn(0, 6) }

    // HorizontalPager for day navigation
    val horizontalPagerState = rememberPagerState(
        initialPage = todayDayIndex,
        pageCount = { 7 }
    )

    // Dialog states
    var showCopyDialog by remember { mutableStateOf(false) }
    var showLoadPreviousDialog by remember { mutableStateOf(false) }
    var showWeekPicker by remember { mutableStateOf(false) }
    var showFillAllCategoriesDialog by remember { mutableStateOf(false) }

    NotiFlowScreenWrapper(
        title = "스케쥴",
        expandedHeight = 56.dp,
        actions = {
            // Calendar picker button
            IconButton(onClick = { showWeekPicker = true }) {
                Icon(
                    Icons.Default.CalendarMonth,
                    contentDescription = "달력",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            // Today button
            IconButton(onClick = {
                viewModel.goToThisWeek()
                scope.launch {
                    horizontalPagerState.animateScrollToPage(todayDayIndex)
                }
            }) {
                Icon(
                    Icons.Default.Today,
                    contentDescription = "오늘",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            // 카테고리 전부 반복 추가
            IconButton(onClick = { showFillAllCategoriesDialog = true }) {
                Icon(
                    Icons.Default.DateRange,
                    contentDescription = "카테고리 전부 반복 추가",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            // Load previous week button
            IconButton(onClick = { showLoadPreviousDialog = true }) {
                Icon(
                    Icons.Default.ContentPaste,
                    contentDescription = "전주 불러오기",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            // Copy week to next button
            IconButton(onClick = { showCopyDialog = true }) {
                Icon(
                    Icons.Default.ContentCopy,
                    contentDescription = "다음주 복사",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Week indicator bar with ◀ ▶ navigation
            WeekIndicatorBar(
                monday = currentMonday,
                selectedDayIndex = horizontalPagerState.currentPage,
                today = today,
                onDayClick = { index ->
                    scope.launch { horizontalPagerState.animateScrollToPage(index) }
                },
                onPreviousWeek = { viewModel.goToPreviousWeek() },
                onNextWeek = { viewModel.goToNextWeek() }
            )

            // Day pager (horizontal only — no nested pager)
            HorizontalPager(
                state = horizontalPagerState,
                modifier = Modifier.fillMaxSize(),
                beyondViewportPageCount = 1
            ) { dayIndex ->
                val dayDate = currentMonday.plusDays(dayIndex.toLong())
                val dayMillis = dayDate.toEpochMillis()

                val dayPlans by remember(weekPlans, dayMillis) {
                    derivedStateOf {
                        weekPlans.filter { it.date == dayMillis }
                    }
                }
                val dayMessages by remember(weekMessages, dayMillis) {
                    derivedStateOf {
                        weekMessages.filter { msg ->
                            val msgDayEnd = dayDate.plusDays(1).toEpochMillis()
                            msg.receivedAt in dayMillis until msgDayEnd
                        }
                    }
                }
                // Day-specific categories
                val dayCategoryIds by remember(weekDayCategories, dayMillis) {
                    derivedStateOf {
                        weekDayCategories
                            .filter { it.date == dayMillis }
                            .map { it.categoryId }
                            .toSet()
                    }
                }
                val dayCategories by remember(allActiveCategories, dayCategoryIds) {
                    derivedStateOf {
                        allActiveCategories.filter { it.id in dayCategoryIds }
                    }
                }
                val availableCategories by remember(allActiveCategories, dayCategoryIds) {
                    derivedStateOf {
                        allActiveCategories.filter { it.id !in dayCategoryIds }
                    }
                }

                DayPlannerContent(
                    date = dayDate,
                    plans = dayPlans,
                    messages = dayMessages,
                    categories = dayCategories,
                    availableCategories = availableCategories,
                    uncategorizedMessages = uncategorizedMessages,
                    onAddPlan = { categoryId, title ->
                        viewModel.addPlan(categoryId, dayDate, title)
                    },
                    onToggleCompletion = { planId, isCompleted ->
                        viewModel.togglePlanCompletion(planId, isCompleted)
                    },
                    onDeletePlan = { plan -> viewModel.deletePlan(plan) },
                    onUpdatePlan = { plan -> viewModel.updatePlan(plan) },
                    onMessageClick = onMessageClick,
                    onCopyPreviousDayForCategory = { categoryId ->
                        viewModel.copyPreviousDayForCategory(categoryId, dayDate)
                    },
                    onAddCategory = { categoryId ->
                        viewModel.addCategoryToDay(dayDate, categoryId)
                    },
                    onRemoveCategory = { categoryId ->
                        viewModel.removeCategoryFromDay(dayDate, categoryId)
                    }
                )
            }
        }

        // Week picker dialog
        if (showWeekPicker) {
            WeekPickerDialog(
                currentMonday = currentMonday,
                onWeekSelected = { selectedDate ->
                    val dayIndex = (selectedDate.dayOfWeek.value - 1).coerceIn(0, 6)
                    viewModel.goToWeekContaining(selectedDate)
                    scope.launch {
                        horizontalPagerState.animateScrollToPage(dayIndex)
                    }
                    showWeekPicker = false
                },
                onDismiss = { showWeekPicker = false }
            )
        }

        // Week copy confirmation dialog
        if (showCopyDialog) {
            WeekCopyConfirmDialog(
                currentMonday = currentMonday,
                onConfirm = {
                    viewModel.copyCurrentWeekToNext()
                    showCopyDialog = false
                },
                onDismiss = { showCopyDialog = false }
            )
        }

        // 카테고리 전부 반복 추가 확인 다이얼로그
        if (showFillAllCategoriesDialog) {
            FillAllCategoriesDialog(
                currentMonday = currentMonday,
                categoryCount = allActiveCategories.size,
                onConfirm = {
                    viewModel.addAllCategoriesToWeek()
                    showFillAllCategoriesDialog = false
                },
                onDismiss = { showFillAllCategoriesDialog = false }
            )
        }

        // Load previous week confirmation dialog
        if (showLoadPreviousDialog) {
            LoadPreviousWeekDialog(
                currentMonday = currentMonday,
                onConfirm = {
                    viewModel.copyPreviousWeekToCurrent()
                    showLoadPreviousDialog = false
                },
                onDismiss = { showLoadPreviousDialog = false }
            )
        }
    }
}

@Composable
private fun WeekIndicatorBar(
    monday: LocalDate,
    selectedDayIndex: Int,
    today: LocalDate,
    onDayClick: (Int) -> Unit,
    onPreviousWeek: () -> Unit = {},
    onNextWeek: () -> Unit = {}
) {
    val glassColors = TwsTheme.glassColors

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = glassColors.surface,
        border = BorderStroke(0.5.dp, glassColors.border.copy(alpha = 0.3f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp)
        ) {
            // Month/Year label with week navigation arrows
            val dateFormatter = remember { DateTimeFormatter.ofPattern("yyyy년 M월", Locale.KOREAN) }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onPreviousWeek,
                    modifier = Modifier.size(32.dp)
                ) {
                    Text(
                        "◀",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    text = monday.format(dateFormatter),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center
                )
                IconButton(
                    onClick = onNextWeek,
                    modifier = Modifier.size(32.dp)
                ) {
                    Text(
                        "▶",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                for (i in 0..6) {
                    val dayDate = monday.plusDays(i.toLong())
                    val isToday = dayDate == today
                    val isSelected = i == selectedDayIndex

                    val bgColor by animateColorAsState(
                        targetValue = when {
                            isSelected && isToday -> MaterialTheme.colorScheme.primary
                            isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                            isToday -> MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
                            else -> Color.Transparent
                        },
                        label = "dayBg"
                    )
                    val textColor = when {
                        isSelected && isToday -> MaterialTheme.colorScheme.onPrimary
                        isSelected -> MaterialTheme.colorScheme.primary
                        i == 5 -> Color(0xFF3B82F6) // Saturday
                        i == 6 -> Color(0xFFEF4444) // Sunday
                        else -> MaterialTheme.colorScheme.onSurface
                    }

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { onDayClick(i) }
                            .background(bgColor, RoundedCornerShape(12.dp))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = DAY_LABELS[i],
                            style = MaterialTheme.typography.labelMedium,
                            color = textColor,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "${dayDate.dayOfMonth}",
                            style = MaterialTheme.typography.bodyLarge,
                            color = textColor,
                            fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DayPlannerContent(
    date: LocalDate,
    plans: List<PlanEntity>,
    messages: List<CapturedMessageEntity>,
    categories: List<CategoryEntity>,
    availableCategories: List<CategoryEntity>,
    uncategorizedMessages: List<CapturedMessageEntity>,
    onAddPlan: (categoryId: String?, title: String) -> Unit,
    onToggleCompletion: (String, Boolean) -> Unit,
    onDeletePlan: (PlanEntity) -> Unit,
    onUpdatePlan: (PlanEntity) -> Unit,
    onMessageClick: (String) -> Unit,
    onCopyPreviousDayForCategory: (categoryId: String) -> Unit = {},
    onAddCategory: (categoryId: String) -> Unit = {},
    onRemoveCategory: (categoryId: String) -> Unit = {}
) {
    var showCategoryPicker by remember { mutableStateOf(false) }

    if (categories.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "카테고리를 추가해주세요",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))
                if (availableCategories.isNotEmpty()) {
                    Surface(
                        modifier = Modifier.clickable { showCategoryPicker = true },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Add,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "카테고리 추가",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(categories, key = { it.id }) { category ->
                val categoryPlans = plans.filter { it.categoryId == category.id }
                val categoryMessages = messages.filter { it.categoryId == category.id }

                CategoryPlanSection(
                    category = category,
                    plans = categoryPlans,
                    messageCount = categoryMessages.size,
                    messages = categoryMessages,
                    uncategorizedMessages = uncategorizedMessages,
                    onAddPlan = { title -> onAddPlan(category.id, title) },
                    onToggleCompletion = onToggleCompletion,
                    onDeletePlan = onDeletePlan,
                    onUpdatePlan = onUpdatePlan,
                    onMessageClick = onMessageClick,
                    onCopyPreviousDay = { onCopyPreviousDayForCategory(category.id) },
                    onRemoveCategory = { onRemoveCategory(category.id) }
                )
            }

            // "Add category" button at the bottom
            if (availableCategories.isNotEmpty()) {
                item {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showCategoryPicker = true },
                        shape = RoundedCornerShape(16.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                        border = BorderStroke(
                            0.5.dp,
                            MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Add,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "카테고리 추가",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }

    // Category picker dialog
    if (showCategoryPicker) {
        CategoryPickerDialog(
            availableCategories = availableCategories,
            onSelect = { categoryId ->
                onAddCategory(categoryId)
                showCategoryPicker = false
            },
            onDismiss = { showCategoryPicker = false }
        )
    }
}

@Composable
private fun CategoryPlanSection(
    category: CategoryEntity,
    plans: List<PlanEntity>,
    messageCount: Int,
    messages: List<CapturedMessageEntity>,
    uncategorizedMessages: List<CapturedMessageEntity>,
    onAddPlan: (String) -> Unit,
    onToggleCompletion: (String, Boolean) -> Unit,
    onDeletePlan: (PlanEntity) -> Unit,
    onUpdatePlan: (PlanEntity) -> Unit,
    onMessageClick: (String) -> Unit,
    onCopyPreviousDay: () -> Unit = {},
    onRemoveCategory: () -> Unit = {}
) {
    val glassColors = TwsTheme.glassColors
    val catColor = Color(category.color)
    var isAdding by remember { mutableStateOf(false) }
    var showMessagePopup by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = glassColors.surface,
        border = BorderStroke(0.5.dp, glassColors.border.copy(alpha = 0.3f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            // Header: category dot + name + message badge + add button
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(catColor)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = category.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )

                // Message badge
                if (messageCount > 0) {
                    Surface(
                        modifier = Modifier.clickable { showMessagePopup = true },
                        shape = RoundedCornerShape(10.dp),
                        color = catColor.copy(alpha = 0.12f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Email,
                                contentDescription = null,
                                modifier = Modifier.size(15.dp),
                                tint = catColor
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "$messageCount",
                                style = MaterialTheme.typography.labelLarge,
                                color = catColor,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                }

                // Remove category from this day
                Surface(
                    modifier = Modifier
                        .size(30.dp)
                        .clickable { onRemoveCategory() },
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.error.copy(alpha = 0.08f)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "이 날짜에서 카테고리 제거",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.6f)
                        )
                    }
                }
                Spacer(modifier = Modifier.width(6.dp))

                // Copy previous week's day plans for this category
                Surface(
                    modifier = Modifier
                        .size(30.dp)
                        .clickable { onCopyPreviousDay() },
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.ContentPaste,
                            contentDescription = "전주 같은 요일 계획 복사",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Spacer(modifier = Modifier.width(6.dp))

                // Add button
                Surface(
                    modifier = Modifier
                        .size(34.dp)
                        .clickable { isAdding = true },
                    shape = CircleShape,
                    color = catColor.copy(alpha = 0.12f)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.Add,
                            contentDescription = "추가",
                            modifier = Modifier.size(20.dp),
                            tint = catColor
                        )
                    }
                }
            }

            if (plans.isNotEmpty() || isAdding) {
                Spacer(modifier = Modifier.height(8.dp))
            }

            // Plan items
            plans.forEach { plan ->
                PlanItem(
                    plan = plan,
                    catColor = catColor,
                    messages = messages,
                    uncategorizedMessages = uncategorizedMessages,
                    onToggleCompletion = { onToggleCompletion(plan.id, !plan.isCompleted) },
                    onDelete = { onDeletePlan(plan) },
                    onUpdatePlan = onUpdatePlan,
                    onMessageClick = onMessageClick
                )
            }

            // Inline add field
            if (isAdding) {
                PlanAddField(
                    catColor = catColor,
                    onSubmit = { title ->
                        onAddPlan(title)
                        isAdding = false
                    },
                    onCancel = { isAdding = false }
                )
            }
        }
    }

    // Message list popup
    if (showMessagePopup) {
        MessageListPopup(
            category = category,
            messages = messages,
            onMessageClick = onMessageClick,
            onDismiss = { showMessagePopup = false }
        )
    }
}

@Composable
private fun PlanItem(
    plan: PlanEntity,
    catColor: Color,
    messages: List<CapturedMessageEntity>,
    uncategorizedMessages: List<CapturedMessageEntity>,
    onToggleCompletion: () -> Unit,
    onDelete: () -> Unit,
    onUpdatePlan: (PlanEntity) -> Unit,
    onMessageClick: (String) -> Unit
) {
    var showMessageLinkDialog by remember { mutableStateOf(false) }
    var showOrderDialog by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = plan.isCompleted,
            onCheckedChange = { onToggleCompletion() },
            modifier = Modifier.size(28.dp),
            colors = CheckboxDefaults.colors(
                checkedColor = catColor,
                uncheckedColor = MaterialTheme.colorScheme.outline
            )
        )
        Spacer(modifier = Modifier.width(6.dp))

        // Title
        Text(
            text = plan.title,
            style = MaterialTheme.typography.bodyLarge,
            color = if (plan.isCompleted) MaterialTheme.colorScheme.onSurfaceVariant
            else MaterialTheme.colorScheme.onSurface,
            textDecoration = if (plan.isCompleted) TextDecoration.LineThrough else TextDecoration.None,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )

        // Order number badge
        if (plan.orderNumber != null) {
            Surface(
                shape = RoundedCornerShape(6.dp),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                modifier = Modifier.padding(horizontal = 2.dp)
            ) {
                Text(
                    text = plan.orderNumber,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                )
            }
        }

        // Linked message indicator
        if (plan.linkedMessageId != null) {
            Icon(
                Icons.Default.Link,
                contentDescription = "연결된 메시지",
                modifier = Modifier
                    .size(20.dp)
                    .clickable { onMessageClick(plan.linkedMessageId) },
                tint = catColor.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.width(2.dp))
        }

        // Message link button
        IconButton(
            onClick = { showMessageLinkDialog = true },
            modifier = Modifier.size(28.dp)
        ) {
            Icon(
                if (plan.linkedMessageId != null) Icons.Default.LinkOff else Icons.Default.Email,
                contentDescription = "메시지 연결",
                modifier = Modifier.size(17.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
        }

        // Order number button
        IconButton(
            onClick = { showOrderDialog = true },
            modifier = Modifier.size(28.dp)
        ) {
            Icon(
                Icons.Default.Tag,
                contentDescription = "주문번호",
                modifier = Modifier.size(17.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
        }

        // Delete button
        IconButton(
            onClick = onDelete,
            modifier = Modifier.size(28.dp)
        ) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "삭제",
                modifier = Modifier.size(17.dp),
                tint = MaterialTheme.colorScheme.error.copy(alpha = 0.5f)
            )
        }
    }

    // Message link dialog — shows day's messages + uncategorized messages
    if (showMessageLinkDialog) {
        MessageLinkDialog(
            messages = messages,
            uncategorizedMessages = uncategorizedMessages,
            currentLinkedId = plan.linkedMessageId,
            onSelect = { messageId ->
                onUpdatePlan(plan.copy(linkedMessageId = messageId))
                showMessageLinkDialog = false
            },
            onUnlink = {
                onUpdatePlan(plan.copy(linkedMessageId = null))
                showMessageLinkDialog = false
            },
            onDismiss = { showMessageLinkDialog = false }
        )
    }

    // Order number dialog
    if (showOrderDialog) {
        OrderNumberDialog(
            currentOrderNumber = plan.orderNumber,
            onConfirm = { orderNumber ->
                onUpdatePlan(plan.copy(orderNumber = orderNumber.ifBlank { null }))
                showOrderDialog = false
            },
            onDismiss = { showOrderDialog = false }
        )
    }
}

@Composable
private fun PlanAddField(
    catColor: Color,
    onSubmit: (String) -> Unit,
    onCancel: () -> Unit
) {
    var text by remember { mutableStateOf("") }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(catColor.copy(alpha = 0.4f))
        )
        Spacer(modifier = Modifier.width(10.dp))

        Surface(
            modifier = Modifier
                .weight(1f)
                .height(40.dp),
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            border = BorderStroke(0.5.dp, catColor.copy(alpha = 0.3f))
        ) {
            BasicTextField(
                value = text,
                onValueChange = { text = it },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge.copy(
                    color = MaterialTheme.colorScheme.onSurface
                ),
                cursorBrush = SolidColor(catColor),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(
                    onDone = {
                        if (text.isNotBlank()) onSubmit(text.trim())
                    }
                ),
                decorationBox = { innerTextField ->
                    Box(contentAlignment = Alignment.CenterStart) {
                        if (text.isEmpty()) {
                            Text(
                                text = "새 계획 입력...",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                        }
                        innerTextField()
                    }
                }
            )
        }

        Spacer(modifier = Modifier.width(4.dp))

        IconButton(
            onClick = { if (text.isNotBlank()) onSubmit(text.trim()) },
            modifier = Modifier.size(34.dp)
        ) {
            Icon(
                Icons.Default.Check,
                contentDescription = "확인",
                modifier = Modifier.size(20.dp),
                tint = catColor
            )
        }
        IconButton(
            onClick = onCancel,
            modifier = Modifier.size(34.dp)
        ) {
            Icon(
                Icons.Default.Close,
                contentDescription = "취소",
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun MessageListPopup(
    category: CategoryEntity,
    messages: List<CapturedMessageEntity>,
    onMessageClick: (String) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(Color(category.color))
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("${category.name} 메시지", style = MaterialTheme.typography.titleMedium)
            }
        },
        text = {
            if (messages.isEmpty()) {
                Text("메시지가 없습니다", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(messages, key = { it.id }) { msg ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onMessageClick(msg.id)
                                    onDismiss()
                                },
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text(
                                    text = msg.sender.ifEmpty { msg.appName },
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1
                                )
                                Text(
                                    text = msg.content,
                                    style = MaterialTheme.typography.bodyMedium,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("닫기") }
        }
    )
}

/**
 * Message link dialog — shows day's messages + uncategorized messages as selectable lists
 */
@Composable
private fun MessageLinkDialog(
    messages: List<CapturedMessageEntity>,
    uncategorizedMessages: List<CapturedMessageEntity>,
    currentLinkedId: String?,
    onSelect: (String) -> Unit,
    onUnlink: () -> Unit,
    onDismiss: () -> Unit
) {
    val dateFormatter = remember {
        java.text.SimpleDateFormat("M/d HH:mm", java.util.Locale.getDefault())
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("메시지 연결", style = MaterialTheme.typography.titleMedium) },
        text = {
            if (messages.isEmpty() && uncategorizedMessages.isEmpty()) {
                Text(
                    "연결할 수 있는 메시지가 없습니다",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    // Section 1: This day's messages
                    if (messages.isNotEmpty()) {
                        item {
                            Text(
                                text = "이 날짜의 메시지",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }
                        items(messages, key = { "day_${it.id}" }) { msg ->
                            MessageLinkItem(
                                msg = msg,
                                isLinked = msg.id == currentLinkedId,
                                onSelect = onSelect
                            )
                        }
                    }

                    // Section 2: Uncategorized messages
                    if (uncategorizedMessages.isNotEmpty()) {
                        item {
                            if (messages.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                            Text(
                                text = "미분류 메시지",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }
                        items(uncategorizedMessages, key = { "uncat_${it.id}" }) { msg ->
                            MessageLinkItem(
                                msg = msg,
                                isLinked = msg.id == currentLinkedId,
                                onSelect = onSelect,
                                subtitle = dateFormatter.format(java.util.Date(msg.receivedAt))
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("닫기") }
        },
        dismissButton = {
            if (currentLinkedId != null) {
                TextButton(onClick = onUnlink) { Text("연결 해제") }
            }
        }
    )
}

@Composable
private fun MessageLinkItem(
    msg: CapturedMessageEntity,
    isLinked: Boolean,
    onSelect: (String) -> Unit,
    subtitle: String? = null
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onSelect(msg.id) },
        shape = RoundedCornerShape(8.dp),
        color = if (isLinked) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        border = if (isLinked) BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.4f))
        else null
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = msg.sender.ifEmpty { msg.appName },
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    if (subtitle != null) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = subtitle,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        )
                    }
                }
                Text(
                    text = msg.content,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (isLinked) {
                Spacer(modifier = Modifier.width(6.dp))
                Icon(
                    Icons.Default.Check,
                    contentDescription = "연결됨",
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun OrderNumberDialog(
    currentOrderNumber: String?,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var orderNumber by remember { mutableStateOf(currentOrderNumber ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("주문번호", style = MaterialTheme.typography.titleMedium) },
        text = {
            OutlinedTextField(
                value = orderNumber,
                onValueChange = { orderNumber = it },
                label = { Text("주문번호 입력") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(orderNumber.trim()) }) { Text("확인") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("취소") }
        }
    )
}

@Composable
private fun WeekCopyConfirmDialog(
    currentMonday: LocalDate,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    val formatter = remember { DateTimeFormatter.ofPattern("M/d", Locale.KOREAN) }
    val currentEnd = currentMonday.plusDays(6)
    val nextMonday = currentMonday.plusWeeks(1)
    val nextEnd = nextMonday.plusDays(6)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("주간 복사", style = MaterialTheme.typography.titleMedium) },
        text = {
            Text(
                text = "${currentMonday.format(formatter)}~${currentEnd.format(formatter)} 계획을 " +
                    "${nextMonday.format(formatter)}~${nextEnd.format(formatter)}로 복사합니다.\n\n" +
                    "완료 상태는 초기화됩니다.",
                style = MaterialTheme.typography.bodyLarge
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) { Text("복사") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("취소") }
        }
    )
}

@Composable
private fun LoadPreviousWeekDialog(
    currentMonday: LocalDate,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    val formatter = remember { DateTimeFormatter.ofPattern("M/d", Locale.KOREAN) }
    val previousMonday = currentMonday.minusWeeks(1)
    val previousEnd = previousMonday.plusDays(6)
    val currentEnd = currentMonday.plusDays(6)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("전주 불러오기", style = MaterialTheme.typography.titleMedium) },
        text = {
            Text(
                text = "${previousMonday.format(formatter)}~${previousEnd.format(formatter)} 계획을 " +
                    "${currentMonday.format(formatter)}~${currentEnd.format(formatter)}로 불러옵니다.\n\n" +
                    "완료 상태는 초기화됩니다.",
                style = MaterialTheme.typography.bodyLarge
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) { Text("불러오기") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("취소") }
        }
    )
}

@Composable
private fun FillAllCategoriesDialog(
    currentMonday: LocalDate,
    categoryCount: Int,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    val formatter = remember { DateTimeFormatter.ofPattern("M/d", Locale.KOREAN) }
    val currentEnd = currentMonday.plusDays(6)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("카테고리 전부 반복 추가", style = MaterialTheme.typography.titleMedium) },
        text = {
            Text(
                text = "${currentMonday.format(formatter)}~${currentEnd.format(formatter)} " +
                    "전체 일자에 활성 카테고리 ${categoryCount}개를 추가합니다.\n\n" +
                    "이미 추가된 카테고리는 유지됩니다.",
                style = MaterialTheme.typography.bodyLarge
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = categoryCount > 0) { Text("추가") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("취소") }
        }
    )
}

@Composable
private fun WeekPickerDialog(
    currentMonday: LocalDate,
    onWeekSelected: (LocalDate) -> Unit,
    onDismiss: () -> Unit
) {
    val today = remember { LocalDate.now() }
    var displayMonth by remember { mutableStateOf(YearMonth.from(currentMonday)) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("주 선택", style = MaterialTheme.typography.titleMedium)
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                // Month header with navigation
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { displayMonth = displayMonth.minusMonths(1) }) {
                        Text(
                            "◀",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Text(
                        text = "${displayMonth.year}년 ${displayMonth.monthValue}월",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = { displayMonth = displayMonth.plusMonths(1) }) {
                        Text(
                            "▶",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Day-of-week header (Mon-first)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    DAY_LABELS.forEachIndexed { index, label ->
                        Text(
                            text = label,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.labelSmall,
                            color = when (index) {
                                5 -> Color(0xFF3B82F6)
                                6 -> Color(0xFFEF4444)
                                else -> MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Calendar grid (Monday-first)
                val firstOfMonth = displayMonth.atDay(1)
                val daysInMonth = displayMonth.lengthOfMonth()
                // Monday=0, Tuesday=1, ..., Sunday=6
                val firstDayOffset = (firstOfMonth.dayOfWeek.value - 1) % 7

                for (row in 0 until 6) {
                    val rowFirstDay = row * 7 - firstDayOffset + 1
                    // Skip row if all days are past end of month
                    if (rowFirstDay > daysInMonth) break

                    // Find a representative date in this row to determine its week
                    val representativeDay = rowFirstDay.coerceAtLeast(1).coerceAtMost(daysInMonth)
                    val representativeDate = displayMonth.atDay(representativeDay)
                    val rowMonday = representativeDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    val isSelectedWeek = rowMonday == currentMonday

                    val weekBgColor = if (isSelectedWeek) {
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)
                    } else {
                        Color.Transparent
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(40.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(weekBgColor)
                            .clickable {
                                onWeekSelected(representativeDate)
                            },
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        for (col in 0..6) {
                            val dayNum = rowFirstDay + col
                            if (dayNum in 1..daysInMonth) {
                                val date = displayMonth.atDay(dayNum)
                                val isToday = date == today

                                val textColor = when {
                                    isToday -> MaterialTheme.colorScheme.primary
                                    col == 5 -> Color(0xFF3B82F6)
                                    col == 6 -> Color(0xFFEF4444)
                                    else -> MaterialTheme.colorScheme.onSurface
                                }

                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .then(
                                            if (isToday) Modifier
                                                .size(30.dp)
                                                .clip(CircleShape)
                                                .background(
                                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                                                    CircleShape
                                                )
                                            else Modifier
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "$dayNum",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = textColor,
                                        fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            } else {
                                Box(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onWeekSelected(today)
            }) { Text("오늘로 이동") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("닫기") }
        }
    )
}

@Composable
private fun CategoryPickerDialog(
    availableCategories: List<CategoryEntity>,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("카테고리 추가", style = MaterialTheme.typography.titleMedium) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                items(availableCategories, key = { it.id }) { category ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(category.id) },
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .clip(CircleShape)
                                    .background(Color(category.color))
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = category.name,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("닫기") }
        }
    )
}
