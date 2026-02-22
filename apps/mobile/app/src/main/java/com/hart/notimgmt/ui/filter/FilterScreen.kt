package com.hart.notimgmt.ui.filter

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SortByAlpha
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
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
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.zIndex
import kotlinx.coroutines.launch
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.db.entity.AppFilterEntity
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.data.db.entity.FilterRuleEntity
import com.hart.notimgmt.ui.theme.NotiFlowDesign
import com.hart.notimgmt.viewmodel.FilterViewModel
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FilterScreen(
    viewModel: FilterViewModel = hiltViewModel()
) {
    val categories by viewModel.categories.collectAsState()
    val rules by viewModel.rulesForCategory.collectAsState()
    val allowedApps by viewModel.allowedApps.collectAsState()
    val smsCaptureEnabled = viewModel.smsCaptureEnabled

    // Local state for smooth drag-and-drop
    var localCategories by remember { mutableStateOf(categories) }
    LaunchedEffect(categories) {
        localCategories = categories
    }

    val lazyListState = rememberLazyListState()
    val reorderableState = rememberReorderableLazyListState(lazyListState) { from, to ->
        localCategories = localCategories.toMutableList().apply {
            val fromIdx = indexOfFirst { it.id == from.key }
            val toIdx = indexOfFirst { it.id == to.key }
            if (fromIdx >= 0 && toIdx >= 0) {
                add(toIdx, removeAt(fromIdx))
            }
        }
    }

    var showCategoryDialog by remember { mutableStateOf(false) }
    var editingCategory by remember { mutableStateOf<CategoryEntity?>(null) }

    // Rules popup state
    var rulesDialogCategory by remember { mutableStateOf<CategoryEntity?>(null) }
    var showRuleDialog by remember { mutableStateOf(false) }
    var editingRule by remember { mutableStateOf<FilterRuleEntity?>(null) }
    var deletingRule by remember { mutableStateOf<FilterRuleEntity?>(null) }

    var deletingCategory by remember { mutableStateOf<CategoryEntity?>(null) }

    // Sort & Search state
    val sortByName by viewModel.sortByName.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var isSearchExpanded by remember { mutableStateOf(false) }
    val sortedListState = rememberLazyListState()
    val sortScope = rememberCoroutineScope()

    val searchScrollConnection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (available.y < -5f && searchQuery.isBlank()) isSearchExpanded = false
                return Offset.Zero
            }

            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: NestedScrollSource
            ): Offset {
                if (available.y > 10f) isSearchExpanded = true
                return Offset.Zero
            }
        }
    }

    val filteredCategories = remember(localCategories, searchQuery) {
        if (searchQuery.isBlank()) localCategories
        else localCategories.filter { it.name.contains(searchQuery, ignoreCase = true) }
    }

    Column(
        modifier = Modifier.fillMaxSize()
    ) {
            // Category Section Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 8.dp, top = 4.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "카테고리",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "${categories.size}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.weight(1f))
                // Sort toggle
                Surface(
                    onClick = { viewModel.toggleSortByName() },
                    shape = RoundedCornerShape(8.dp),
                    color = if (sortByName) MaterialTheme.colorScheme.primaryContainer
                    else MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (sortByName) Icons.Default.SortByAlpha
                            else Icons.Default.DragHandle,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = if (sortByName) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(
                            text = if (sortByName) "이름순" else "우선순위",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (sortByName) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                // Add category button
                IconButton(
                    onClick = {
                        editingCategory = null
                        showCategoryDialog = true
                    },
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = "카테고리 추가",
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Search bar (swipe to show/hide)
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
                            "카테고리 이름으로 검색",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    leadingIcon = {
                        Icon(
                            Icons.Default.Search,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
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
                    shape = RoundedCornerShape(10.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent
                    ),
                    textStyle = MaterialTheme.typography.bodySmall
                )
            }

            // Category list
            if (categories.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "카테고리가 없습니다.\n+ 버튼을 눌러 카테고리를 추가하세요.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else if (searchQuery.isNotBlank()) {
                // Search mode: chosung-grouped stickyHeader list (no drag)
                val grouped = remember(filteredCategories) {
                    filteredCategories.sortedBy { it.name }
                        .groupBy { getChosung(it.name.first()) }
                }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .nestedScroll(searchScrollConnection),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    item(key = "search_count") {
                        Text(
                            text = "${filteredCategories.size}개 검색됨",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                        )
                    }

                    if (filteredCategories.isEmpty()) {
                        item(key = "no_results") {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "검색 결과가 없습니다.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    } else {
                        grouped.forEach { (chosung, cats) ->
                            stickyHeader(key = "header_$chosung") {
                                ChosungStickyHeader(chosung)
                            }

                            items(cats, key = { it.id }) { category ->
                                CategoryItem(
                                    category = category,
                                    dragModifier = Modifier,
                                    onClick = {
                                        viewModel.selectCategory(category.id)
                                        rulesDialogCategory = category
                                    },
                                    onEdit = {
                                        editingCategory = category
                                        showCategoryDialog = true
                                    },
                                    onDelete = {
                                        deletingCategory = category
                                    },
                                    onCopy = {
                                        viewModel.copyCategory(category)
                                    },
                                    onToggleActive = {
                                        viewModel.toggleCategoryActive(category)
                                    }
                                )
                            }
                        }
                    }
                }
            } else if (sortByName) {
                // Name-sorted mode: flat list with sidebar index
                val nameSorted = remember(localCategories) {
                    localCategories.sortedBy { it.name }
                }
                val grouped = remember(nameSorted) {
                    nameSorted.groupBy { getChosung(it.name.first()) }
                }
                val chosungKeys = remember(grouped) { grouped.keys.toList() }

                // Build index: chosung → item index in LazyColumn (no headers)
                val chosungIndexMap = remember(grouped) {
                    val map = mutableMapOf<String, Int>()
                    var idx = 0
                    grouped.forEach { (chosung, cats) ->
                        map[chosung] = idx
                        idx += cats.size
                    }
                    map
                }

                Box(modifier = Modifier.fillMaxSize()) {
                    LazyColumn(
                        state = sortedListState,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(end = 20.dp)
                            .nestedScroll(searchScrollConnection),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        items(nameSorted, key = { it.id }) { category ->
                            CategoryItem(
                                category = category,
                                dragModifier = Modifier,
                                onClick = {
                                    viewModel.selectCategory(category.id)
                                    rulesDialogCategory = category
                                },
                                onEdit = {
                                    editingCategory = category
                                    showCategoryDialog = true
                                },
                                onDelete = {
                                    deletingCategory = category
                                },
                                onCopy = {
                                    viewModel.copyCategory(category)
                                },
                                onToggleActive = {
                                    viewModel.toggleCategoryActive(category)
                                }
                            )
                        }
                    }

                    // Sidebar alphabet index
                    if (chosungKeys.size > 1) {
                        ChosungSidebar(
                            chosungList = chosungKeys,
                            onSelect = { chosung ->
                                chosungIndexMap[chosung]?.let { targetIdx ->
                                    sortScope.launch {
                                        sortedListState.animateScrollToItem(targetIdx)
                                    }
                                }
                            },
                            modifier = Modifier
                                .align(Alignment.CenterEnd)
                                .fillMaxHeight()
                                .padding(vertical = 8.dp)
                        )
                    }
                }
            } else {
                // Default mode: priority-ordered reorderable list
                LazyColumn(
                    state = lazyListState,
                    modifier = Modifier
                        .fillMaxSize()
                        .nestedScroll(searchScrollConnection),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    item(key = "priority_guide") {
                        Text(
                            text = "위에 있는 카테고리가 우선순위가 높습니다. 여러 규칙에 매칭될 경우 우선순위가 높은 카테고리로 분류됩니다.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                        )
                    }

                    // Reorderable category items
                    items(localCategories, key = { it.id }) { category ->
                        ReorderableItem(reorderableState, key = category.id) { isDragging ->
                            CategoryItem(
                                category = category,
                                isDragging = isDragging,
                                dragModifier = Modifier.draggableHandle(
                                    onDragStopped = {
                                        viewModel.reorderCategories(localCategories)
                                    }
                                ),
                                onClick = {
                                    viewModel.selectCategory(category.id)
                                    rulesDialogCategory = category
                                },
                                onEdit = {
                                    editingCategory = category
                                    showCategoryDialog = true
                                },
                                onDelete = {
                                    deletingCategory = category
                                },
                                onCopy = {
                                    viewModel.copyCategory(category)
                                },
                                onToggleActive = {
                                    viewModel.toggleCategoryActive(category)
                                }
                            )
                        }
                    }
                }
            }
    }

    // ===== Dialogs =====

    // Category rules popup
    rulesDialogCategory?.let { category ->
        CategoryRulesDialog(
            category = category,
            rules = rules,
            allowedApps = allowedApps,
            onDismiss = {
                rulesDialogCategory = null
                viewModel.selectCategory(null)
            },
            onAddRule = {
                editingRule = null
                showRuleDialog = true
            },
            onEditRule = { rule ->
                editingRule = rule
                showRuleDialog = true
            },
            onDeleteRule = { rule ->
                deletingRule = rule
            },
            onToggleRule = { rule, active ->
                viewModel.updateRule(rule.copy(isActive = active))
            }
        )
    }

    // Category add/edit dialog
    if (showCategoryDialog) {
        CategoryEditDialog(
            category = editingCategory,
            existingNames = categories.map { it.name },
            onDismiss = {
                showCategoryDialog = false
                editingCategory = null
            },
            onSave = { name, color ->
                if (editingCategory != null) {
                    viewModel.updateCategory(editingCategory!!.copy(name = name, color = color))
                } else {
                    viewModel.addCategory(name, color)
                }
                showCategoryDialog = false
                editingCategory = null
            }
        )
    }

    // Category delete confirmation
    deletingCategory?.let { category ->
        AlertDialog(
            onDismissRequest = { deletingCategory = null },
            title = { Text("카테고리 삭제", style = MaterialTheme.typography.titleMedium) },
            text = {
                Text(
                    "'${category.name}' 카테고리를 삭제하시겠습니까?\n관련된 필터 규칙과 메시지가 영향을 받습니다.",
                    style = MaterialTheme.typography.bodyMedium
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteCategory(category)
                    if (rulesDialogCategory?.id == category.id) {
                        rulesDialogCategory = null
                        viewModel.selectCategory(null)
                    }
                    deletingCategory = null
                }) {
                    Text("삭제", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { deletingCategory = null }) { Text("취소") }
            },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(12.dp)
        )
    }

    // Rule delete confirmation
    deletingRule?.let { rule ->
        AlertDialog(
            onDismissRequest = { deletingRule = null },
            title = { Text("필터 규칙 삭제", style = MaterialTheme.typography.titleMedium) },
            text = { Text("이 필터 규칙을 삭제하시겠습니까?", style = MaterialTheme.typography.bodyMedium) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteRule(rule)
                    deletingRule = null
                }) {
                    Text("삭제", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { deletingRule = null }) { Text("취소") }
            },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(12.dp)
        )
    }

    // Rule add/edit dialog
    if (showRuleDialog && rulesDialogCategory != null) {
        FilterRuleEditDialog(
            rule = editingRule,
            categoryId = rulesDialogCategory!!.id,
            allowedApps = allowedApps,
            smsCaptureEnabled = smsCaptureEnabled,
            onDismiss = {
                showRuleDialog = false
                editingRule = null
            },
            onSave = { entity ->
                if (editingRule != null) {
                    viewModel.updateRule(entity)
                } else {
                    viewModel.addRule(entity)
                }
                showRuleDialog = false
                editingRule = null
            }
        )
    }

}

// ===== Category Rules Popup Dialog =====

@Composable
private fun CategoryRulesDialog(
    category: CategoryEntity,
    rules: List<FilterRuleEntity>,
    allowedApps: List<AppFilterEntity> = emptyList(),
    onDismiss: () -> Unit,
    onAddRule: () -> Unit,
    onEditRule: (FilterRuleEntity) -> Unit,
    onDeleteRule: (FilterRuleEntity) -> Unit,
    onToggleRule: (FilterRuleEntity, Boolean) -> Unit
) {
    val catColor = Color(category.color)
    val glassColors = NotiFlowDesign.glassColors

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, glassColors.border),
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 200.dp, max = 500.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                // Header
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(catColor.copy(alpha = 0.8f))
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = category.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = MaterialTheme.colorScheme.primaryContainer
                        ) {
                            Text(
                                text = "${rules.size}개",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "닫기",
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                Spacer(modifier = Modifier.height(12.dp))

                // Rules list
                if (rules.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Outlined.FilterList,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "필터 규칙이 없습니다.\n아래 버튼을 눌러 규칙을 추가하세요.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(rules, key = { it.id }) { rule ->
                            DialogRuleItem(
                                rule = rule,
                                allowedApps = allowedApps,
                                onEdit = { onEditRule(rule) },
                                onDelete = { onDeleteRule(rule) },
                                onToggleActive = { active -> onToggleRule(rule, active) }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Add rule button
                OutlinedButton(
                    onClick = onAddRule,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary)
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("규칙 추가")
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DialogRuleItem(
    rule: FilterRuleEntity,
    allowedApps: List<AppFilterEntity> = emptyList(),
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggleActive: (Boolean) -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = if (rule.isActive) glassColors.surfaceLight
        else glassColors.surfaceLight.copy(alpha = 0.5f),
        border = BorderStroke(1.dp, glassColors.border),
        modifier = Modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            // 대상 앱 표시 (pill chips)
            if (rule.targetAppPackages.isNotEmpty()) {
                val appNames = rule.targetAppPackages.map { pkg ->
                    if (pkg == "SMS") "SMS"
                    else allowedApps.find { it.packageName == pkg }?.appName ?: pkg
                }
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    appNames.forEach { name ->
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
                        ) {
                            Text(
                                text = name,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
            }

            if (rule.senderKeywords.isNotEmpty()) {
                val keywordsText = rule.senderKeywords.joinToString(", ") { item ->
                    if (item.isEnabled) item.keyword else "(${item.keyword})"
                }
                Text(
                    text = "발신자: $keywordsText",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (rule.isActive) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            }

            if (rule.includeWords.isNotEmpty()) {
                val keywordsText = rule.includeWords.joinToString(", ") { item ->
                    if (item.isEnabled) item.keyword else "(${item.keyword})"
                }
                Text(
                    text = "키워드: $keywordsText",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Switch(
                    checked = rule.isActive,
                    onCheckedChange = onToggleActive,
                    modifier = Modifier.size(width = 40.dp, height = 22.dp),
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = MaterialTheme.colorScheme.surface,
                        checkedTrackColor = MaterialTheme.colorScheme.onSurface
                    )
                )
                Spacer(modifier = Modifier.width(12.dp))
                IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = "편집",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "삭제",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}

// ===== Category Item =====

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CategoryItem(
    category: CategoryEntity,
    isDragging: Boolean = false,
    dragModifier: Modifier = Modifier,
    onClick: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onCopy: () -> Unit,
    onToggleActive: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }
    val catColor = Color(category.color)
    val glassColors = NotiFlowDesign.glassColors
    val isActive = category.isActive

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .then(if (isDragging) Modifier.zIndex(1f) else Modifier)
            .animateContentSize()
            .combinedClickable(
                onClick = onClick,
                onLongClick = { showMenu = true }
            ),
        shape = RoundedCornerShape(12.dp),
        color = when {
            isDragging -> catColor.copy(alpha = 0.12f)
            !isActive -> glassColors.surface.copy(alpha = 0.5f)
            else -> glassColors.surface
        },
        border = BorderStroke(
            1.dp,
            when {
                isDragging -> catColor.copy(alpha = 0.6f)
                !isActive -> glassColors.border.copy(alpha = 0.3f)
                else -> glassColors.border
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 4.dp, end = 4.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Drag handle
            Icon(
                Icons.Default.DragHandle,
                contentDescription = "순서 변경",
                modifier = dragModifier.size(24.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )

            Spacer(modifier = Modifier.width(6.dp))

            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(
                        if (isActive) catColor.copy(alpha = 0.8f)
                        else catColor.copy(alpha = 0.3f)
                    )
            )

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = category.name,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Normal,
                color = if (isActive) MaterialTheme.colorScheme.onSurface
                else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                modifier = Modifier.weight(1f)
            )

            // 활성화 토글
            Switch(
                checked = isActive,
                onCheckedChange = { onToggleActive() },
                modifier = Modifier.size(width = 44.dp, height = 24.dp),
                colors = SwitchDefaults.colors(
                    checkedThumbColor = MaterialTheme.colorScheme.surface,
                    checkedTrackColor = catColor,
                    uncheckedThumbColor = MaterialTheme.colorScheme.outline,
                    uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant
                )
            )

            Box {
                Row {
                    IconButton(onClick = onEdit, modifier = Modifier.size(36.dp)) {
                        Icon(
                            Icons.Default.Edit,
                            contentDescription = "편집",
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(36.dp)) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "삭제",
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
                        )
                    }
                }

                DropdownMenu(
                    expanded = showMenu,
                    onDismissRequest = { showMenu = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("편집") },
                        onClick = { showMenu = false; onEdit() },
                        leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    )
                    DropdownMenuItem(
                        text = { Text("복사") },
                        onClick = { showMenu = false; onCopy() },
                        leadingIcon = { Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    )
                    DropdownMenuItem(
                        text = { Text("삭제") },
                        onClick = { showMenu = false; onDelete() },
                        leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    )
                }
            }
        }
    }
}

// ===== Chosung Header & Sidebar =====

@Composable
private fun ChosungStickyHeader(chosung: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
        shape = RoundedCornerShape(6.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 2.dp)
    ) {
        Text(
            text = chosung,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        )
    }
}

@Composable
private fun ChosungSidebar(
    chosungList: List<String>,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var activeChosung by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = modifier
            .width(22.dp)
            .clip(RoundedCornerShape(11.dp))
            .background(MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f))
            .pointerInput(chosungList) {
                awaitEachGesture {
                    val down = awaitFirstDown()
                    val itemHeight = size.height.toFloat() / chosungList.size
                    val idx = (down.position.y / itemHeight)
                        .toInt()
                        .coerceIn(0, chosungList.lastIndex)
                    activeChosung = chosungList[idx]
                    onSelect(chosungList[idx])

                    do {
                        val event = awaitPointerEvent()
                        event.changes.forEach { it.consume() }
                        val y = event.changes.firstOrNull()?.position?.y ?: break
                        val newIdx = (y / itemHeight)
                            .toInt()
                            .coerceIn(0, chosungList.lastIndex)
                        if (chosungList[newIdx] != activeChosung) {
                            activeChosung = chosungList[newIdx]
                            onSelect(chosungList[newIdx])
                        }
                    } while (event.changes.any { it.pressed })

                    activeChosung = null
                }
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceEvenly
    ) {
        chosungList.forEach { chosung ->
            val isActive = chosung == activeChosung
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .then(
                        if (isActive) Modifier
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
                        else Modifier
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = chosung,
                    fontSize = 10.sp,
                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (isActive) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                )
            }
        }
    }
}

// ===== Helpers =====

private fun getChosung(char: Char): String {
    val chosungList = listOf(
        "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ",
        "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
    )
    if (char in '가'..'힣') {
        return chosungList[(char.code - 0xAC00) / 28 / 21]
    }
    if (char.isLetter()) return char.uppercaseChar().toString()
    return "#"
}
