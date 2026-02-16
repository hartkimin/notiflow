package com.hart.notimgmt.ui.filter

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.ui.components.ColorPicker
import com.hart.notimgmt.ui.components.predefinedColors

private const val MAX_CATEGORY_NAME_LENGTH = 30

@Composable
fun CategoryEditDialog(
    category: CategoryEntity? = null,
    existingNames: List<String> = emptyList(),
    onDismiss: () -> Unit,
    onSave: (name: String, color: Int) -> Unit
) {
    var name by remember { mutableStateOf(category?.name ?: "") }
    var selectedColor by remember {
        mutableIntStateOf(category?.color ?: predefinedColors.first().toArgb())
    }

    val nameError by remember(name) {
        derivedStateOf {
            val trimmed = name.trim()
            when {
                trimmed.isEmpty() -> null // 빈 상태에서는 에러 표시 안 함 (저장 버튼 비활성화)
                trimmed.length > MAX_CATEGORY_NAME_LENGTH -> "${MAX_CATEGORY_NAME_LENGTH}자 이내로 입력해주세요"
                existingNames.any { it.equals(trimmed, ignoreCase = true) && it != category?.name } ->
                    "이미 존재하는 카테고리 이름입니다"
                else -> null
            }
        }
    }

    val canSave by remember(name, nameError) {
        derivedStateOf {
            name.trim().isNotEmpty() && nameError == null
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (category == null) "카테고리 추가" else "카테고리 편집",
                style = MaterialTheme.typography.titleMedium
            )
        },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { if (it.length <= MAX_CATEGORY_NAME_LENGTH + 5) name = it },
                    label = { Text("카테고리 이름") },
                    singleLine = true,
                    isError = nameError != null,
                    supportingText = nameError?.let { error ->
                        { Text(error, color = MaterialTheme.colorScheme.error) }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.onSurface,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline
                    )
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    "색상 선택",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                ColorPicker(
                    selectedColor = selectedColor,
                    onColorSelected = { selectedColor = it }
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { if (canSave) onSave(name.trim(), selectedColor) },
                enabled = canSave
            ) {
                Text("저장")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("취소") }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(12.dp)
    )
}
