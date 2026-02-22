package com.hart.notimgmt.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.ui.theme.*

val predefinedColors: List<Color> = listOf(
    NotiFlowIndigo,           // Sky Blue (Primary)
    NotiFlowViolet,              // Mint
    NotiFlowIndigoDark,       // Deep Blue
    Color(0xFFE91E63),    // Pink
    Color(0xFF9C27B0),    // Purple
    Color(0xFF4CAF50),    // Green
    Color(0xFFFFC107),    // Amber
    Color(0xFFFF5722),    // Deep Orange
    Color(0xFF795548),    // Brown
    Color(0xFF607D8B)     // Blue Grey
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ColorPicker(
    selectedColor: Int,
    onColorSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    FlowRow(
        modifier = modifier.padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        predefinedColors.forEach { color ->
            val argb = color.toArgb()
            val isSelected = argb == selectedColor
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .then(
                        if (isSelected) {
                            Modifier
                                .border(3.dp, Color.White, CircleShape)
                                .border(2.dp, color, CircleShape)
                        } else {
                            Modifier
                        }
                    )
                    .clip(CircleShape)
                    .background(if (isSelected) color else color.copy(alpha = 0.85f))
                    .clickable { onColorSelected(argb) },
                contentAlignment = Alignment.Center
            ) {
                if (isSelected) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
