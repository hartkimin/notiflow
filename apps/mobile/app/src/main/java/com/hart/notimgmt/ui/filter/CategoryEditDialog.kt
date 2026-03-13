package com.hart.notimgmt.ui.filter

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Category
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.ui.components.ColorPicker
import com.hart.notimgmt.ui.components.GlassButton
import com.hart.notimgmt.ui.components.GlassDivider
import com.hart.notimgmt.ui.components.GlassOutlinedButton
import com.hart.notimgmt.ui.components.predefinedColors
import com.hart.notimgmt.ui.theme.NotiRouteDesign

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
                trimmed.isEmpty() -> null
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

    val glassColors = NotiRouteDesign.glassColors

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, glassColors.border),
            modifier = Modifier
                .fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                // Title row: Icon + title
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Category,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (category == null) "카테고리 추가" else "카테고리 편집",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))
                GlassDivider()
                Spacer(modifier = Modifier.height(16.dp))

                // Name section
                Text(
                    "이름",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(6.dp))
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
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.onSurface,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Color section
                Text(
                    "색상",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                ColorPicker(
                    selectedColor = selectedColor,
                    onColorSelected = { selectedColor = it }
                )

                Spacer(modifier = Modifier.weight(1f, fill = false))
                Spacer(modifier = Modifier.height(16.dp))

                // Buttons row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp)
                ) {
                    GlassOutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("취소")
                    }
                    GlassButton(
                        onClick = { if (canSave) onSave(name.trim(), selectedColor) },
                        modifier = Modifier.weight(1f),
                        enabled = canSave
                    ) {
                        Text("저장")
                    }
                }
            }
        }
    }
}

