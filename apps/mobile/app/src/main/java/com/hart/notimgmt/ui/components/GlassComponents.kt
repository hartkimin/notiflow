package com.hart.notimgmt.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.ui.theme.*

// ============================================
// NotiFlow iOS Glassmorphism Components
// ============================================

/**
 * 글래스 카드 - 반투명 배경에 블러 효과
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(16.dp),
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors

    Surface(
        modifier = modifier
            .then(
                if (onClick != null) {
                    Modifier.clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = ripple(color = MaterialTheme.colorScheme.primary),
                        onClick = onClick
                    )
                } else Modifier
            ),
        shape = shape,
        color = glassColors.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, glassColors.border)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            content = content
        )
    }
}

/**
 * 글래스 서피스 - 커스텀 패딩 지원
 */
@Composable
fun GlassSurface(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(16.dp),
    contentPadding: PaddingValues = PaddingValues(16.dp),
    onClick: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors

    Surface(
        modifier = modifier
            .then(
                if (onClick != null) {
                    Modifier.clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = ripple(color = MaterialTheme.colorScheme.primary),
                        onClick = onClick
                    )
                } else Modifier
            ),
        shape = shape,
        color = glassColors.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, glassColors.border)
    ) {
        Box(
            modifier = Modifier.padding(contentPadding),
            content = content
        )
    }
}

/**
 * 글래스 버튼 - Primary 스타일
 */
@Composable
fun GlassButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = TwsSkyBlue,
            contentColor = TwsWhite,
            disabledContainerColor = TwsSkyBlue.copy(alpha = 0.5f),
            disabledContentColor = TwsWhite.copy(alpha = 0.7f)
        ),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 4.dp,
            pressedElevation = 2.dp
        ),
        content = content
    )
}

/**
 * 글래스 버튼 - Secondary 스타일 (테두리만)
 */
@Composable
fun GlassOutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors

    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = glassColors.surfaceLight,
            contentColor = MaterialTheme.colorScheme.primary,
            disabledContainerColor = glassColors.surfaceLight.copy(alpha = 0.5f),
            disabledContentColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        ),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        ),
        content = content
    )
}

/**
 * 글래스 FAB - 그라데이션 효과
 */
@Composable
fun GlassFab(
    onClick: () -> Unit,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    contentDescription: String? = null
) {
    val glassColors = NotiFlowDesign.glassColors

    Box(
        modifier = modifier
            .size(56.dp)
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(
                        glassColors.gradientStart,
                        glassColors.gradientMiddle
                    )
                ),
                shape = CircleShape
            )
            .clip(CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = TwsWhite,
            modifier = Modifier.size(24.dp)
        )
    }
}

/**
 * 글래스 네비게이션 바 아이템
 */
@Composable
fun GlassNavItem(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(24.dp)
        )
        if (selected) {
            Spacer(modifier = Modifier.height(4.dp))
            Box(
                modifier = Modifier
                    .size(4.dp)
                    .background(MaterialTheme.colorScheme.primary, CircleShape)
            )
        }
    }
}

/**
 * 글래스 입력 필드
 */
@Composable
fun GlassTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    singleLine: Boolean = true,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null
) {
    val glassColors = NotiFlowDesign.glassColors

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        placeholder = {
            Text(
                text = placeholder,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
            )
        },
        singleLine = singleLine,
        leadingIcon = leadingIcon,
        trailingIcon = trailingIcon,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = glassColors.surfaceLight,
            unfocusedContainerColor = glassColors.surfaceLight,
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = glassColors.border,
            cursorColor = MaterialTheme.colorScheme.primary
        )
    )
}

/**
 * 글래스 칩 - iOS 스타일 태그
 */
@Composable
fun GlassChip(
    label: String,
    selected: Boolean = false,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val glassColors = NotiFlowDesign.glassColors
    val backgroundColor = if (selected) MaterialTheme.colorScheme.primary else glassColors.surfaceLight
    val contentColor = if (selected) TwsWhite else MaterialTheme.colorScheme.onSurface

    Surface(
        modifier = modifier
            .then(
                if (onClick != null) {
                    Modifier.clickable(onClick = onClick)
                } else Modifier
            ),
        shape = RoundedCornerShape(20.dp),
        color = backgroundColor,
        border = if (!selected) androidx.compose.foundation.BorderStroke(1.dp, glassColors.border) else null
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = contentColor,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        )
    }
}

/**
 * 그라데이션 디바이더
 */
@Composable
fun GlassDivider(
    modifier: Modifier = Modifier
) {
    val glassColors = NotiFlowDesign.glassColors

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(
                brush = Brush.horizontalGradient(
                    colors = listOf(
                        Color.Transparent,
                        glassColors.border,
                        glassColors.border,
                        Color.Transparent
                    )
                )
            )
    )
}
