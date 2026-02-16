package com.hart.notimgmt.ui.message

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.ui.theme.TwsTheme

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageCard(
    message: CapturedMessageEntity,
    categoryName: String,
    categoryColor: Int,
    statusName: String?,
    statusColor: Int?,
    allStatusSteps: List<StatusStepEntity> = emptyList(),
    onClick: () -> Unit,
    onLongClick: () -> Unit = {},
    onStatusChange: (String) -> Unit = {},
    isSelectionMode: Boolean = false,
    isSelected: Boolean = false
) {
    val catColor = Color(categoryColor)
    val glassColors = TwsTheme.glassColors
    val borderColor = when {
        isSelected -> MaterialTheme.colorScheme.primary
        message.isPinned -> MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        else -> glassColors.border
    }
    val bgColor = when {
        isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
        else -> glassColors.surface
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .shadow(
                elevation = 8.dp,
                shape = RoundedCornerShape(16.dp),
                ambientColor = glassColors.shadow,
                spotColor = glassColors.shadow
            )
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = RoundedCornerShape(16.dp),
        color = bgColor,
        border = BorderStroke(
            if (isSelected) 1.5.dp else 1.dp,
            borderColor
        )
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
                    .padding(16.dp)
            ) {
            // Top row: app icon + sender info + time
            val context = LocalContext.current
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                // App icon (실제 앱 아이콘 표시)
                val appIconBitmap = remember(message.source) {
                    try {
                        val drawable = context.packageManager.getApplicationIcon(message.source)
                        val size = 84
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
                            .size(42.dp)
                            .clip(CircleShape)
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(catColor.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (message.source == "SMS")
                                Icons.Default.Sms else Icons.Default.Notifications,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp),
                            tint = catColor
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
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

                        // Category tag
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

                    // App name (if different from sender)
                    if (message.appName.isNotEmpty() && message.appName != message.sender) {
                        Text(
                            text = message.appName,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1
                        )
                    }
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Time + unread dot
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = formatRelativeTime(message.receivedAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (message.statusId == null) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Message content
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = MaterialTheme.typography.bodyMedium.lineHeight
            )

            // 스누즈 표시
            if (message.snoozeAt != null && message.snoozeAt > System.currentTimeMillis()) {
                Spacer(modifier = Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Alarm,
                        contentDescription = "스누즈",
                        modifier = Modifier.size(12.dp),
                        tint = Color(0xFFF59E0B)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = formatSnoozeTime(message.snoozeAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFFF59E0B)
                    )
                }
            }

            // Status badge with dropdown
            if (statusName != null || allStatusSteps.isNotEmpty()) {
                Spacer(modifier = Modifier.height(10.dp))

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
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
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
        } // end Column
    } // end Row
    } // end Surface
}

fun formatRelativeTime(timestamp: Long): String {
    val format = java.text.SimpleDateFormat("yyyy/MM/dd HH:mm", java.util.Locale.getDefault())
    return format.format(java.util.Date(timestamp))
}

fun formatSnoozeTime(snoozeAt: Long): String {
    val remaining = snoozeAt - System.currentTimeMillis()
    if (remaining <= 0) return "곧 알림"
    val hours = remaining / (1000 * 60 * 60)
    val minutes = (remaining % (1000 * 60 * 60)) / (1000 * 60)
    return when {
        hours > 24 -> {
            val format = java.text.SimpleDateFormat("M/d HH:mm", java.util.Locale.getDefault())
            format.format(java.util.Date(snoozeAt))
        }
        hours > 0 -> "${hours}시간 ${minutes}분 후 알림"
        else -> "${minutes}분 후 알림"
    }
}
