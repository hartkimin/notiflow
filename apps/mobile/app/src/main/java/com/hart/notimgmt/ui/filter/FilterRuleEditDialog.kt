package com.hart.notimgmt.ui.filter

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.data.db.entity.AppFilterEntity
import com.hart.notimgmt.data.db.entity.FilterRuleEntity
import com.hart.notimgmt.data.model.ConditionType
import com.hart.notimgmt.data.model.KeywordItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilterRuleEditDialog(
    rule: FilterRuleEntity? = null,
    categoryId: String,
    allowedApps: List<AppFilterEntity> = emptyList(),
    smsCaptureEnabled: Boolean = false,
    onDismiss: () -> Unit,
    onSave: (FilterRuleEntity) -> Unit
) {
    val senderKeywords = remember {
        mutableStateListOf<KeywordItem>().apply {
            rule?.senderKeywords?.let { addAll(it) }
        }
    }
    val includeWords = remember {
        mutableStateListOf<KeywordItem>().apply {
            rule?.includeWords?.let { addAll(it) }
        }
    }
    var isActive by remember { mutableStateOf(rule?.isActive ?: true) }
    var conditionType by remember { mutableStateOf(rule?.conditionType ?: ConditionType.AND) }

    // App selection state
    var isAllApps by remember { mutableStateOf(rule?.targetAppPackages?.isEmpty() ?: true) }
    val selectedAppPackages = remember {
        mutableStateListOf<String>().apply {
            rule?.targetAppPackages?.let { addAll(it) }
        }
    }

    var senderInput by remember { mutableStateOf("") }
    var includeInput by remember { mutableStateOf("") }

    val scrollState = rememberScrollState()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val textFieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = MaterialTheme.colorScheme.onSurface,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
        ) {
            // 헤더: 타이틀 + 저장 버튼
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (rule == null) "필터 규칙 추가" else "필터 규칙 편집",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Surface(
                    onClick = {
                        // 입력 중인 키워드가 있으면 자동 추가
                        if (senderInput.isNotBlank()) {
                            senderKeywords.add(KeywordItem(senderInput.trim()))
                            senderInput = ""
                        }
                        if (includeInput.isNotBlank()) {
                            includeWords.add(KeywordItem(includeInput.trim()))
                            includeInput = ""
                        }
                        val entity = FilterRuleEntity(
                            id = rule?.id ?: java.util.UUID.randomUUID().toString(),
                            categoryId = categoryId,
                            senderKeywords = senderKeywords.toList(),
                            includeWords = includeWords.toList(),
                            conditionType = conditionType,
                            targetAppPackages = if (isAllApps) emptyList()
                            else selectedAppPackages.toList(),
                            isActive = isActive,
                            createdAt = rule?.createdAt ?: System.currentTimeMillis(),
                            updatedAt = System.currentTimeMillis()
                        )
                        onSave(entity)
                    },
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.primary
                ) {
                    Text(
                        text = "저장",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 스크롤 가능한 본문
            Column(modifier = Modifier.verticalScroll(scrollState)) {
                // 활성화 토글
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "규칙 활성화",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f)
                    )
                    Switch(
                        checked = isActive,
                        onCheckedChange = { isActive = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = MaterialTheme.colorScheme.surface,
                            checkedTrackColor = MaterialTheme.colorScheme.onSurface
                        )
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ━━ 1. 대상 앱 ━━
                Text(
                    "대상 앱",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "이 규칙이 적용될 앱",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    SegmentedSelector(
                        options = listOf("전체 앱" to true, "특정 앱" to false),
                        selected = isAllApps,
                        onSelect = { isAllApps = it }
                    )
                    if (!isAllApps && selectedAppPackages.isNotEmpty()) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "선택됨: ${selectedAppPackages.size}개",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                if (!isAllApps) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                        border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                    ) {
                        Column(modifier = Modifier.padding(8.dp)) {
                            // SMS option
                            if (smsCaptureEnabled) {
                                AppCheckboxItem(
                                    appName = "SMS",
                                    packageName = "SMS",
                                    isChecked = "SMS" in selectedAppPackages,
                                    onCheckedChange = { checked ->
                                        if (checked) selectedAppPackages.add("SMS")
                                        else selectedAppPackages.remove("SMS")
                                    }
                                )
                                if (allowedApps.isNotEmpty()) {
                                    HorizontalDivider(
                                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f),
                                        modifier = Modifier.padding(vertical = 2.dp)
                                    )
                                }
                            }
                            // Allowed apps
                            allowedApps.forEachIndexed { index, app ->
                                AppCheckboxItem(
                                    appName = app.appName,
                                    packageName = app.packageName,
                                    isChecked = app.packageName in selectedAppPackages,
                                    onCheckedChange = { checked ->
                                        if (checked) selectedAppPackages.add(app.packageName)
                                        else selectedAppPackages.remove(app.packageName)
                                    }
                                )
                                if (index < allowedApps.lastIndex) {
                                    HorizontalDivider(
                                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f),
                                        modifier = Modifier.padding(vertical = 2.dp)
                                    )
                                }
                            }
                            if (allowedApps.isEmpty() && !smsCaptureEnabled) {
                                Text(
                                    "등록된 앱이 없습니다.\n앱 필터 설정에서 앱을 추가하세요.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(8.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ━━ 2. 발신자 키워드 ━━
                Text(
                    "발신자 키워드",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "발신자 이름에 포함된 키워드 (OR 조건)",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = senderInput,
                        onValueChange = { senderInput = it },
                        label = { Text("발신자 입력") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp),
                        colors = textFieldColors
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    IconButton(
                        onClick = {
                            if (senderInput.isNotBlank()) {
                                senderKeywords.add(KeywordItem(senderInput.trim()))
                                senderInput = ""
                            }
                        }
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "추가")
                    }
                }

                if (senderKeywords.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Column(
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        senderKeywords.forEachIndexed { index, item ->
                            KeywordChipWithToggle(
                                keyword = item.keyword,
                                isEnabled = item.isEnabled,
                                onToggle = { enabled ->
                                    senderKeywords[index] = item.copy(isEnabled = enabled)
                                },
                                onDelete = { senderKeywords.removeAt(index) }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ━━ 3. AND/OR 조건 선택 ━━
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "조건 연결",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f)
                    )
                    SegmentedSelector(
                        options = listOf("AND" to ConditionType.AND, "OR" to ConditionType.OR),
                        selected = conditionType,
                        onSelect = { conditionType = it }
                    )
                }
                Text(
                    if (conditionType == ConditionType.AND)
                        "발신자와 포함 키워드 모두 일치해야 매칭"
                    else
                        "발신자 또는 포함 키워드 중 하나만 일치해도 매칭",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )

                Spacer(modifier = Modifier.height(16.dp))

                // ━━ 4. 포함 키워드 ━━
                Text(
                    "포함 키워드",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "메시지 내용에 포함된 키워드 (OR 조건)",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = includeInput,
                        onValueChange = { includeInput = it },
                        label = { Text("키워드 입력") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp),
                        colors = textFieldColors
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    IconButton(
                        onClick = {
                            if (includeInput.isNotBlank()) {
                                includeWords.add(KeywordItem(includeInput.trim()))
                                includeInput = ""
                            }
                        }
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "추가")
                    }
                }

                if (includeWords.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Column(
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        includeWords.forEachIndexed { index, item ->
                            KeywordChipWithToggle(
                                keyword = item.keyword,
                                isEnabled = item.isEnabled,
                                onToggle = { enabled ->
                                    includeWords[index] = item.copy(isEnabled = enabled)
                                },
                                onDelete = { includeWords.removeAt(index) }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ━━ 필터링 조건 요약 카드 ━━
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            "필터링 조건 요약",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(4.dp))

                        // 대상 앱 요약
                        val appSummary = if (isAllApps) {
                            "전체"
                        } else {
                            val names = selectedAppPackages.map { pkg ->
                                if (pkg == "SMS") "SMS"
                                else allowedApps.find { it.packageName == pkg }?.appName ?: pkg
                            }
                            if (names.isEmpty()) "선택 없음"
                            else if (names.size <= 2) names.joinToString(", ")
                            else "${names.take(2).joinToString(", ")} 외 ${names.size - 2}개"
                        }
                        Text(
                            "• 대상 앱: $appSummary",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Text(
                            "• 발신자 키워드 중 하나라도 포함 (OR)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            "• 포함 키워드 중 하나라도 포함 (OR)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            if (conditionType == ConditionType.AND)
                                "• 위 두 조건을 모두 만족 (AND)"
                            else
                                "• 위 두 조건 중 하나만 만족 (OR)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun AppCheckboxItem(
    appName: String,
    packageName: String,
    isChecked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = isChecked,
            onCheckedChange = onCheckedChange,
            modifier = Modifier.size(32.dp),
            colors = CheckboxDefaults.colors(
                checkedColor = MaterialTheme.colorScheme.primary,
                uncheckedColor = MaterialTheme.colorScheme.outline
            )
        )
        Spacer(modifier = Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = appName,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium
            )
            if (packageName != "SMS" && packageName != appName) {
                Text(
                    text = packageName,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun KeywordChipWithToggle(
    keyword: String,
    isEnabled: Boolean,
    onToggle: (Boolean) -> Unit,
    onDelete: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = if (isEnabled)
            MaterialTheme.colorScheme.surfaceVariant
        else
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        border = BorderStroke(
            0.5.dp,
            if (isEnabled)
                MaterialTheme.colorScheme.outline
            else
                MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier.padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = keyword,
                style = MaterialTheme.typography.bodyMedium,
                color = if (isEnabled)
                    MaterialTheme.colorScheme.onSurface
                else
                    MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                modifier = Modifier.weight(1f)
            )

            Switch(
                checked = isEnabled,
                onCheckedChange = onToggle,
                modifier = Modifier.size(width = 40.dp, height = 24.dp),
                colors = SwitchDefaults.colors(
                    checkedThumbColor = MaterialTheme.colorScheme.surface,
                    checkedTrackColor = MaterialTheme.colorScheme.primary,
                    uncheckedThumbColor = MaterialTheme.colorScheme.outline,
                    uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant
                )
            )

            IconButton(
                onClick = onDelete,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "삭제",
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun <T> SegmentedSelector(
    options: List<Pair<String, T>>,
    selected: T,
    onSelect: (T) -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { (label, value) ->
            val isSelected = selected == value
            Surface(
                onClick = { onSelect(value) },
                shape = RoundedCornerShape(6.dp),
                color = if (isSelected)
                    MaterialTheme.colorScheme.onSurface
                else
                    MaterialTheme.colorScheme.surface,
                border = if (!isSelected)
                    BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline)
                else
                    null
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal,
                    color = if (isSelected)
                        MaterialTheme.colorScheme.surface
                    else
                        MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
        }
    }
}
